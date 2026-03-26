import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import type { AuthResponse, RegisterRequest } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane rejestracji.",
        },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Użytkownik z takim adresem e-mail już istnieje.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: defaultDisplayName(email),
        bio: "",
      },
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Konto zostało utworzone. Możesz się teraz zalogować.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      {
        success: false,
        message: "Nie udało się utworzyć konta. Spróbuj ponownie.",
      },
      { status: 500 },
    );
  }
}
