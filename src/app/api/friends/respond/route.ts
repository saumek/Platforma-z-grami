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

    const body = (await request.json()) as {
      requestId?: string;
      action?: "accept" | "reject";
    };
    const requestId = body.requestId?.trim();
    const action = body.action;

    if (!requestId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nieprawidłowe dane odpowiedzi na zaproszenie." },
        { status: 400 },
      );
    }

    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
      },
    });

    if (!friendRequest || friendRequest.receiverId !== session.user.id) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie znaleziono tego zaproszenia." },
        { status: 404 },
      );
    }

    if (friendRequest.status !== "pending") {
      return NextResponse.json<AuthResponse>({
        success: true,
        message: "To zaproszenie zostało już obsłużone.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.friendRequest.update({
        where: { id: friendRequest.id },
        data: {
          status: action === "accept" ? "accepted" : "rejected",
          respondedAt: new Date(),
        },
      });

      await tx.notification.updateMany({
        where: {
          userId: session.user.id,
          friendRequestId: friendRequest.id,
          type: "friend_request",
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      if (action === "accept") {
        await tx.friendship.upsert({
          where: {
            userId_friendId: {
              userId: friendRequest.senderId,
              friendId: friendRequest.receiverId,
            },
          },
          update: {},
          create: {
            userId: friendRequest.senderId,
            friendId: friendRequest.receiverId,
          },
        });

        await tx.friendship.upsert({
          where: {
            userId_friendId: {
              userId: friendRequest.receiverId,
              friendId: friendRequest.senderId,
            },
          },
          update: {},
          create: {
            userId: friendRequest.receiverId,
            friendId: friendRequest.senderId,
          },
        });

        await tx.notification.create({
          data: {
            userId: friendRequest.senderId,
            actorId: friendRequest.receiverId,
            type: "friend_request_accepted",
            friendRequestId: friendRequest.id,
          },
        });
      }
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      message: action === "accept" ? "Zaproszenie zaakceptowane." : "Zaproszenie odrzucone.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się obsłużyć zaproszenia." },
      { status: 500 },
    );
  }
}
