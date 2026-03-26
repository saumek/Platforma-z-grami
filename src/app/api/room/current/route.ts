import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

type RoomStateResponse =
  | (AuthResponse & {
      roomCode?: undefined;
      activeUsersCount?: undefined;
      userOne?: undefined;
      userTwo?: undefined;
      userOneWins?: undefined;
      userTwoWins?: undefined;
    })
  | {
      success: true;
      message: string;
      roomCode: string;
      activeUsersCount: number;
      userOne: string;
      userTwo: string;
      userOneWins: number;
      userTwoWins: number;
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
        email: true,
        displayName: true,
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

    const roomUsers = await prisma.user.findMany({
      where: { currentRoomCode: currentUser.currentRoomCode },
      select: {
        email: true,
        displayName: true,
      },
      orderBy: { createdAt: "asc" },
      take: 2,
    });

    const labels = roomUsers.map((user) => user.displayName ?? defaultDisplayName(user.email));
    const fallbackCurrentName =
      currentUser.displayName ?? defaultDisplayName(currentUser.email);
    const battleshipGame = await prisma.battleshipGame.findUnique({
      where: { roomCode: currentUser.currentRoomCode },
      select: {
        playerOneWins: true,
        playerTwoWins: true,
      },
    });

    return NextResponse.json<RoomStateResponse>({
      success: true,
      message: "Pobrano stan pokoju.",
      roomCode: currentUser.currentRoomCode,
      activeUsersCount: roomUsers.length,
      userOne: labels[0] ?? fallbackCurrentName,
      userTwo: labels[1] ?? "Oczekiwanie...",
      userOneWins: battleshipGame?.playerOneWins ?? 0,
      userTwoWins: battleshipGame?.playerTwoWins ?? 0,
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
