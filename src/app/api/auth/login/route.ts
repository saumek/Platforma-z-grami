import { NextResponse } from "next/server";

import {
  createSession,
  getSessionId,
  invalidateSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUserFromRoom } from "@/lib/room-cleanup";
import { assignUserToRoom } from "@/lib/room";
import { normalizeRoomCode } from "@/lib/room-code";
import { loginSchema } from "@/lib/validations";
import type { AuthResponse, LoginRequest } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane logowania.",
        },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        currentRoomCode: true,
      },
    });

    if (!user) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Nie znaleziono użytkownika o podanym adresie e-mail.",
        },
        { status: 401 },
      );
    }

    const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Hasło jest nieprawidłowe.",
        },
        { status: 401 },
      );
    }

    const existingSessionId = await getSessionId();
    const existingSession = existingSessionId
      ? await prisma.session.findUnique({
          where: { id: existingSessionId },
          select: { id: true, userId: true },
        })
      : null;

    if (parsed.data.room?.trim()) {
      const roomCode = normalizeRoomCode(parsed.data.room);
      const roomAssignment = await assignUserToRoom(user.id, roomCode);

      if (!roomAssignment.success) {
        return NextResponse.json<AuthResponse>(
          {
            success: false,
            message: "Nie można dołączyć do pokoju, bo jest już pełny.",
          },
          { status: 409 },
        );
      }

    }

    if (existingSession && existingSession.userId !== user.id) {
      await removeUserFromRoom(existingSession.userId);
    }

    if (existingSessionId) {
      await invalidateSession(existingSessionId);
    }

    await createSession(user.id);

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Logowanie zakończone sukcesem.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      {
        success: false,
        message: "Nie udało się zalogować. Spróbuj ponownie.",
      },
      { status: 500 },
    );
  }
}
