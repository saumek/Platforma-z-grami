import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getCoupleQaState, startCoupleQaGame } from "@/lib/couple-qa";
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

    await startCoupleQaGame(user.currentRoomCode, session.user.id);
    const state = await getCoupleQaState(user.currentRoomCode, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Uruchomiono pytania dla par.",
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się uruchomić gry." },
      { status: 500 },
    );
  }
}
