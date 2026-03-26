import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  getCurrentSession,
  getSessionId,
  invalidateSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

export async function POST() {
  try {
    const sessionId = await getSessionId();
    const session = await getCurrentSession();

    if (session) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          currentRoomCode: null,
        },
      });
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
