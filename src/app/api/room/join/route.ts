import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { assignUserToRoom } from "@/lib/room";
import { normalizeRoomCode } from "@/lib/room-code";
import { roomJoinSchema } from "@/lib/validations";
import type { AuthResponse } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession({ mutateCookie: true });

    if (!session) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Najpierw zaloguj się do swojego konta.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { code?: string };
    const parsed = roomJoinSchema.safeParse({ code: body.code });

    if (!parsed.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Nieprawidłowy kod pokoju.",
        },
        { status: 400 },
      );
    }

    const roomCode = normalizeRoomCode(parsed.data.code);
    const roomAssignment = await assignUserToRoom(session.user.id, roomCode);

    if (!roomAssignment.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Nie można dołączyć do pokoju, bo jest już pełny.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Dołączono do pokoju.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      {
        success: false,
        message: "Nie udało się dołączyć do pokoju.",
      },
      { status: 500 },
    );
  }
}
