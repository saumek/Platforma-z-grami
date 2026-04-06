import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoomUsersWithScores } from "@/lib/room-scoreboard";
import type { AuthResponse } from "@/types/auth";

type RoomStateResponse =
  | (AuthResponse & {
      roomCode?: undefined;
      activeUsersCount?: undefined;
      users?: undefined;
    })
  | {
      success: true;
      message: string;
      roomCode: string;
      activeUsersCount: number;
      users: Array<{
        id: string;
        name: string;
        points: number;
      }>;
    };

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json<RoomStateResponse>(
        {
          success: false,
          message: "Najpierw zaloguj się do swojego konta.",
        },
        { status: 401 },
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        currentRoomCode: true,
      },
    });

    if (!currentUser?.currentRoomCode) {
      return NextResponse.json<RoomStateResponse>(
        {
          success: false,
          message: "Nie jesteś obecnie w żadnym pokoju.",
        },
        { status: 409 },
      );
    }

    const roomState = await getRoomUsersWithScores(currentUser.currentRoomCode);

    return NextResponse.json<RoomStateResponse>({
      success: true,
      message: "Pobrano stan pokoju.",
      roomCode: currentUser.currentRoomCode,
      activeUsersCount: roomState.activeUsersCount,
      users: roomState.users,
    });
  } catch {
    return NextResponse.json<RoomStateResponse>(
      {
        success: false,
        message: "Nie udało się pobrać stanu pokoju.",
      },
      { status: 500 },
    );
  }
}
