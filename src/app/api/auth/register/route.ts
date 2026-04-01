import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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

    const passwordHash = await hashPassword(parsed.data.password);
    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: defaultDisplayName(email),
          bio: "",
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json<AuthResponse>(
          {
            success: false,
            message: "Użytkownik z takim adresem e-mail już istnieje.",
          },
          { status: 409 },
        );
      }

      throw error;
    }

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
