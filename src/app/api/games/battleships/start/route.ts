import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { ensureBattleshipGame, getBattleshipState } from "@/lib/battleships";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

export async function POST() {
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

    await ensureBattleshipGame(user.currentRoomCode, { resetTerminated: true });
    const state = await getBattleshipState(user.currentRoomCode, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Uruchomiono grę Statki 5x5.",
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się uruchomić gry." },
      { status: 500 },
    );
  }
}
