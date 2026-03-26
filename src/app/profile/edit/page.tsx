import { redirect } from "next/navigation";

import { ProfileEditScreen } from "@/components/profile-edit-screen";
import { getCurrentSession } from "@/lib/auth";
import { defaultBio, defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export default async function ProfileEditPage() {
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
    },
  });

  if (!user) {
    redirect("/");
  }

  return (
    <ProfileEditScreen
      displayName={user.displayName ?? defaultDisplayName(user.email)}
      bio={user.bio ?? defaultBio()}
      avatarPath={user.avatarPath}
    />
  );
}
