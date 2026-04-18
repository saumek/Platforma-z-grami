import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  getCurrentSession,
  getSessionId,
  invalidateSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetRoomIfEmpty } from "@/lib/room-cleanup";
import type { AuthResponse } from "@/types/auth";

export async function POST() {
  try {
    const sessionId = await getSessionId();
    const session = await getCurrentSession({ mutateCookie: true });

    if (session) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { currentRoomCode: true },
      });
      const previousRoomCode = currentUser?.currentRoomCode ?? null;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          currentRoomCode: null,
        },
      });

      await resetRoomIfEmpty(previousRoomCode);
    }

    if (sessionId) {
      await invalidateSession(sessionId);
    } else {
      await clearSessionCookie();
    }

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Wylogowano pomyślnie.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      {
        success: false,
        message: "Nie udało się wylogować.",
      },
      { status: 500 },
    );
  }
}
