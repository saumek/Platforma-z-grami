import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { publishGameEvent } from "@/lib/game-events";
import { prisma } from "@/lib/prisma";
import { getScienceQuizState } from "@/lib/science-quiz";
import type { AuthResponse } from "@/types/auth";

export async function GET(request: Request) {
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
        { success: false, message: "Nie jesteś obecnie w żadnym pokoju." },
        { status: 409 },
      );
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const before = await prisma.scienceQuizGame.findUnique({
      where: { roomCode: user.currentRoomCode },
      select: { version: true },
    });
    const state = await getScienceQuizState(user.currentRoomCode, session.user.id, category);
    const after = await prisma.scienceQuizGame.findUnique({
      where: { roomCode: user.currentRoomCode },
      select: { version: true },
    });

    if (before?.version !== after?.version && after) {
      publishGameEvent(user.currentRoomCode);
    }

    return NextResponse.json({
      success: true,
      message: "Pobrano stan quizu.",
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się pobrać stanu quizu." },
      { status: 500 },
    );
  }
}
