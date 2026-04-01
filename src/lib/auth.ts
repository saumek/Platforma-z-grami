import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { removeUserFromRoom } from "@/lib/room-cleanup";
import { SESSION_DURATION_MS, shouldRefreshSession } from "@/lib/session-refresh";

const SESSION_COOKIE = "gamely_session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.deleteMany({
    where: { userId },
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return { sessionId, expiresAt };
}

async function refreshSession(sessionId: string, nextExpiresAt: Date) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      expiresAt: nextExpiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: nextExpiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function invalidateSession(sessionId: string) {
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });

  await clearSessionCookie();
}

export async function getSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getCurrentSession() {
  const sessionId = await getSessionId();

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await removeUserFromRoom(session.user.id);
    await invalidateSession(session.id);
    return null;
  }

  if (shouldRefreshSession(session.expiresAt)) {
    const nextExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await refreshSession(session.id, nextExpiresAt);
    session.expiresAt = nextExpiresAt;
  }

  return session;
}

export async function requireUserSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  return session;
}
