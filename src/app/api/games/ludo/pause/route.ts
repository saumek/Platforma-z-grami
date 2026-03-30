import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { setLudoPauseState } from "@/lib/ludo";
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
        { success: false, message: "Nie jesteś obecnie w żadnym pokoju." },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { action?: "pause" | "resume" };
    const result = await setLudoPauseState(
      user.currentRoomCode,
      session.user.id,
      body.action === "resume" ? "resume" : "pause",
    );

    return NextResponse.json<AuthResponse>(
      { success: result.success, message: result.message },
      { status: result.success ? 200 : 400 },
    );
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się zmienić stanu gry." },
      { status: 500 },
    );
  }
}

