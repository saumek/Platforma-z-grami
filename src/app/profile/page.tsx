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
      id: true,
      email: true,
      displayName: true,
      bio: true,
      avatarPath: true,
      currentRoomCode: true,
      notifications: {
        where: {
          readAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          type: true,
          createdAt: true,
          actor: {
            select: {
              email: true,
              displayName: true,
              avatarPath: true,
            },
          },
          friendRequest: {
            select: {
              id: true,
              status: true,
              senderId: true,
              receiverId: true,
            },
          },
        },
      },
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
      currentRoomCode={user.currentRoomCode}
      hasJoinedRoom={Boolean(user.currentRoomCode)}
      notifications={user.notifications.map((notification) => ({
        id: notification.id,
        type: notification.type as "friend_request" | "friend_request_accepted",
        actorName: notification.actor
          ? notification.actor.displayName ?? defaultDisplayName(notification.actor.email)
          : "Użytkownik",
        actorAvatarPath: notification.actor?.avatarPath ?? null,
        friendRequestId: notification.friendRequest?.id ?? null,
        isActionable:
          notification.type === "friend_request" &&
          notification.friendRequest?.status === "pending" &&
          notification.friendRequest.receiverId === user.id,
      }))}
    />
  );
}
