import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startScienceQuizGame, getScienceQuizState } from "@/lib/science-quiz";
import type { AuthResponse } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

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

    const body = (await request.json().catch(() => ({}))) as { category?: string };

    await startScienceQuizGame(user.currentRoomCode, session.user.id, body.category);
    const state = await getScienceQuizState(user.currentRoomCode, session.user.id, body.category);

    return NextResponse.json({
      success: true,
      message: "Uruchomiono quiz naukowy.",
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się uruchomić quizu." },
      { status: 500 },
    );
  }
}
