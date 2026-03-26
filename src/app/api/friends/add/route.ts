import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
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

    const body = (await request.json()) as { friendId?: string };
    const friendId = body.friendId?.trim();

    if (!friendId) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie wybrano użytkownika do dodania." },
        { status: 400 },
      );
    }

    if (friendId === session.user.id) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie możesz dodać samego siebie." },
        { status: 400 },
      );
    }

    const friend = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true },
    });

    if (!friend) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie znaleziono wybranego użytkownika." },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: session.user.id,
            friendId,
          },
        },
        update: {},
        create: {
          userId: session.user.id,
          friendId,
        },
      }),
      prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: friendId,
            friendId: session.user.id,
          },
        },
        update: {},
        create: {
          userId: friendId,
          friendId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Dodano do znajomych.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się dodać do znajomych." },
      { status: 500 },
    );
  }
}
