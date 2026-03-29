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

    const body = (await request.json()) as { notificationId?: string };
    const notificationId = body.notificationId?.trim();

    if (!notificationId) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie wybrano powiadomienia." },
        { status: 400 },
      );
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!notification || notification.userId !== session.user.id) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Nie znaleziono powiadomienia." },
        { status: 404 },
      );
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Powiadomienie zostało oznaczone jako przeczytane.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: "Nie udało się zaktualizować powiadomienia." },
      { status: 500 },
    );
  }
}
