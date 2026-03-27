import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitScienceQuizAnswer } from "@/lib/science-quiz";
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

    const body = (await request.json()) as { answerIndex?: number };
    const result = await submitScienceQuizAnswer(
      user.currentRoomCode,
      session.user.id,
      body.answerIndex ?? -1,
    );

    return NextResponse.json<AuthResponse>(
      { success: result.success, message: result.message },
      { status: result.success ? 200 : 400 },
    );
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się zapisać odpowiedzi." },
      { status: 500 },
    );
  }
}
