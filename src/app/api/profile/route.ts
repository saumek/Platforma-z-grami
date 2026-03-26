import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { defaultBio, defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validations";
import type { AuthResponse } from "@/types/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "profiles");
const PUBLIC_PREFIX = "/uploads/profiles";
const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function isManagedAvatar(pathname: string | null) {
  return Boolean(pathname?.startsWith(PUBLIC_PREFIX));
}

export async function PUT(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: "Najpierw zaloguj się do swojego konta.",
        },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const parsed = profileUpdateSchema.safeParse({
      displayName: formData.get("displayName"),
      bio: formData.get("bio"),
    });

    if (!parsed.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane profilu.",
        },
        { status: 400 },
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarPath: true },
    });

    let avatarPath = currentUser?.avatarPath ?? null;
    const avatarFile = formData.get("avatar");

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const extension = ALLOWED_TYPES.get(avatarFile.type);

      if (!extension) {
        return NextResponse.json<AuthResponse>(
          {
            success: false,
            message: "Avatar musi być plikiem JPG, PNG lub WEBP.",
          },
          { status: 400 },
        );
      }

      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json<AuthResponse>(
          {
            success: false,
            message: "Avatar może mieć maksymalnie 5 MB.",
          },
          { status: 400 },
        );
      }

      await mkdir(UPLOAD_DIR, { recursive: true });

      const fileName = `${session.user.id}-${randomUUID()}${extension}`;
      const destination = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      await writeFile(destination, buffer);

      const previousAvatarPath = currentUser?.avatarPath ?? null;

      if (previousAvatarPath && isManagedAvatar(previousAvatarPath)) {
        const previousFile = path.join(process.cwd(), "public", previousAvatarPath);
        await unlink(previousFile).catch(() => undefined);
      }

      avatarPath = `${PUBLIC_PREFIX}/${fileName}`;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: parsed.data.displayName,
        bio: parsed.data.bio,
        avatarPath,
      },
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      message: "Profil został zaktualizowany.",
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      {
        success: false,
        message: "Nie udało się zapisać zmian profilu.",
      },
      { status: 500 },
    );
  }
}
