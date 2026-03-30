import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getLudoGameState } from "@/lib/ludo";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

export async function GET() {
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
        { success: false, message: "Nie jesteś obecnie w żadnym pokoju." },
        { status: 409 },
      );
    }

    const state = await getLudoGameState(user.currentRoomCode, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Pobrano stan gry.",
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się pobrać stanu gry." },
      { status: 500 },
    );
  }
}

