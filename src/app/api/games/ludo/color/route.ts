import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { chooseLudoColor, getLudoGameState } from "@/lib/ludo";
import { prisma } from "@/lib/prisma";
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

    const body = (await request.json().catch(() => ({}))) as { color?: string };
    const result = await chooseLudoColor(user.currentRoomCode, session.user.id, body.color ?? "");

    if (!result.success) {
      return NextResponse.json<AuthResponse>(result, { status: 400 });
    }

    const state = await getLudoGameState(user.currentRoomCode, session.user.id);

    return NextResponse.json({
      success: true,
      message: result.message,
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się zapisać koloru." },
      { status: 500 },
    );
  }
}

