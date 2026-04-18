import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { publishGameReaction } from "@/lib/game-events";
import { isGameReactionKind } from "@/lib/game-reactions";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession({ mutateCookie: true });

    if (!session) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Najpierw zaloguj się do swojego konta." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentRoomCode: true },
    });

    if (!user?.currentRoomCode) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Najpierw dołącz do pokoju." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as { reaction?: unknown };

    if (!isGameReactionKind(body.reaction)) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nieprawidłowa reakcja." },
        { status: 400 },
      );
    }

    publishGameReaction(user.currentRoomCode, body.reaction, session.user.id);

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Wysłano reakcję.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się wysłać reakcji." },
      { status: 500 },
    );
  }
}
