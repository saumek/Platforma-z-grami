import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession({ mutateCookie: true });

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

    const [friend, existingFriendship, outgoingRequest, incomingRequest] = await Promise.all([
      prisma.user.findUnique({
        where: { id: friendId },
        select: { id: true },
      }),
      prisma.friendship.findUnique({
        where: {
          userId_friendId: {
            userId: session.user.id,
            friendId,
          },
        },
        select: { id: true },
      }),
      prisma.friendRequest.findUnique({
        where: {
          senderId_receiverId: {
            senderId: session.user.id,
            receiverId: friendId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      }),
      prisma.friendRequest.findUnique({
        where: {
          senderId_receiverId: {
            senderId: friendId,
            receiverId: session.user.id,
          },
        },
        select: {
          id: true,
          status: true,
        },
      }),
    ]);

    if (!friend) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie znaleziono wybranego użytkownika." },
        { status: 404 },
      );
    }

    if (existingFriendship) {
      return NextResponse.json<AuthResponse>({
        success: true,
        message: "Ta osoba jest już w Twoich znajomych.",
      });
    }

    if (incomingRequest?.status === "pending") {
      return NextResponse.json<AuthResponse>({
        success: true,
        message: "Ta osoba już wysłała Ci zaproszenie. Sprawdź powiadomienia.",
      });
    }

    if (outgoingRequest?.status === "pending") {
      return NextResponse.json<AuthResponse>({
        success: true,
        message: "Zaproszenie zostało już wysłane.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const friendRequest = outgoingRequest
        ? await tx.friendRequest.update({
            where: { id: outgoingRequest.id },
            data: {
              status: "pending",
              respondedAt: null,
            },
          })
        : await tx.friendRequest.create({
            data: {
              senderId: session.user.id,
              receiverId: friendId,
              status: "pending",
            },
          });

      const existingUnreadRequestNotification = await tx.notification.findFirst({
        where: {
          userId: friendId,
          actorId: session.user.id,
          type: "friend_request",
          friendRequestId: friendRequest.id,
          readAt: null,
        },
        select: { id: true },
      });

      if (!existingUnreadRequestNotification) {
        await tx.notification.create({
          data: {
            userId: friendId,
            actorId: session.user.id,
            type: "friend_request",
            friendRequestId: friendRequest.id,
          },
        });
      }
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Zaproszenie do znajomych zostało wysłane.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się wysłać zaproszenia." },
      { status: 500 },
    );
  }
}
