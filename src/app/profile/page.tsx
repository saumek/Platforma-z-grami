import { redirect } from "next/navigation";

import { ProfileScreen } from "@/components/profile-screen";
import { getCurrentSession } from "@/lib/auth";
import { defaultBio, defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      displayName: true,
      bio: true,
      avatarPath: true,
      currentRoomCode: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  return (
    <ProfileScreen
      displayName={user.displayName ?? defaultDisplayName(user.email)}
      bio={user.bio?.trim() ? user.bio : defaultBio()}
      avatarPath={user.avatarPath}
      hasJoinedRoom={Boolean(user.currentRoomCode)}
    />
  );
}
