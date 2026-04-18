import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import {
  buildProfileAvatarPaths,
  commitProfileAvatar,
  deleteManagedProfileAvatar,
  discardProfileAvatar,
  hasAllowedImageSignature,
  stageProfileAvatar,
} from "@/lib/avatar-storage";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validations";
import type { AuthResponse } from "@/types/auth";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export async function PUT(request: Request) {
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
    let avatarStaging:
      | {
          stagedPath: string;
          finalPath: string;
          publicPath: string;
        }
      | null = null;

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

      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      if (!hasAllowedImageSignature(buffer, avatarFile.type)) {
        return NextResponse.json<AuthResponse>(
          {
            success: false,
            message: "Plik avatara ma nieprawidłową sygnaturę.",
          },
          { status: 400 },
        );
      }

      avatarStaging = buildProfileAvatarPaths(session.user.id, extension);

      try {
        await stageProfileAvatar(buffer, avatarStaging.stagedPath);
        await commitProfileAvatar(avatarStaging.stagedPath, avatarStaging.finalPath);
        avatarPath = avatarStaging.publicPath;
      } catch (error) {
        if (avatarStaging) {
          await discardProfileAvatar(avatarStaging);
        }

        throw error;
      }
    }

    const previousAvatarPath = currentUser?.avatarPath ?? null;

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          displayName: parsed.data.displayName,
          bio: parsed.data.bio,
          avatarPath,
        },
      });
    } catch (error) {
      if (avatarStaging) {
        await discardProfileAvatar(avatarStaging);
      }

      throw error;
    }

    if (avatarStaging && previousAvatarPath && previousAvatarPath !== avatarPath) {
      await deleteManagedProfileAvatar(previousAvatarPath);
    }

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
