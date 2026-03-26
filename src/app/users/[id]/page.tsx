import { notFound, redirect } from "next/navigation";

import { UserProfileScreen } from "@/components/user-profile-screen";
import { requireUserSession } from "@/lib/auth";
import { defaultBio, defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

type UserProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const session = await requireUserSession();
  const { id } = await params;

  if (id === session.user.id) {
    redirect("/profile");
  }

  const [targetUser, currentUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        displayName: true,
        bio: true,
        avatarPath: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        currentRoomCode: true,
      },
    }),
  ]);

  if (!targetUser) {
    notFound();
  }

  return (
    <UserProfileScreen
      displayName={targetUser.displayName ?? defaultDisplayName(targetUser.email)}
      bio={targetUser.bio?.trim() ? targetUser.bio : defaultBio()}
      avatarPath={targetUser.avatarPath}
      hasJoinedRoom={Boolean(currentUser?.currentRoomCode)}
    />
  );
}
