import { redirect } from "next/navigation";

import { requireUserSession } from "@/lib/auth";
import { FriendsScreen } from "@/components/friends-screen";
import { isActiveNow } from "@/lib/presence";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export default async function FriendsPage() {
  const session = await requireUserSession();

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      currentRoomCode: true,
      friends: {
        select: {
          friendId: true,
        },
      },
      sentFriendRequests: {
        where: {
          status: "pending",
        },
        select: {
          receiverId: true,
        },
      },
      receivedFriendRequests: {
        where: {
          status: "pending",
        },
        select: {
          senderId: true,
        },
      },
    },
  });

  if (!currentUser) {
    redirect("/");
  }

  const friendIds = currentUser.friends.map((entry) => entry.friendId);
  const outgoingRequestIds = new Set(currentUser.sentFriendRequests.map((entry) => entry.receiverId));
  const incomingRequestIds = new Set(currentUser.receivedFriendRequests.map((entry) => entry.senderId));

  const friends = friendIds.length
    ? await prisma.user.findMany({
        where: { id: { in: friendIds } },
        select: {
          id: true,
          email: true,
          displayName: true,
          bio: true,
          avatarPath: true,
          currentRoomCode: true,
          sessions: {
            select: {
              expiresAt: true,
            },
          },
        },
        orderBy: { displayName: "asc" },
      })
    : [];

  const roommate =
    currentUser.currentRoomCode
      ? await prisma.user.findFirst({
          where: {
            currentRoomCode: currentUser.currentRoomCode,
            id: { not: currentUser.id },
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarPath: true,
          },
        })
      : null;

  const isRoommateFriend = roommate ? friendIds.includes(roommate.id) : false;
  const roommateRelationship = roommate
    ? isRoommateFriend
      ? "friend"
      : outgoingRequestIds.has(roommate.id)
        ? "outgoing_pending"
        : incomingRequestIds.has(roommate.id)
          ? "incoming_pending"
          : "none"
    : "none";

  const friendItems = friends.map((friend) => {
    const active = friend.sessions.some((session) => isActiveNow(session.expiresAt));
    const roomCode = active ? friend.currentRoomCode : null;
    const isInCurrentRoom =
      Boolean(currentUser.currentRoomCode) &&
      Boolean(roomCode) &&
      currentUser.currentRoomCode === roomCode;

    return {
      id: friend.id,
      displayName: friend.displayName ?? defaultDisplayName(friend.email),
      avatarPath: friend.avatarPath,
      roomCode,
      isInCurrentRoom,
      isActive: active,
      activityLabel: active
        ? roomCode
          ? "Aktywna teraz"
          : "Online"
        : "Offline",
    };
  });

  const onlineCount = friendItems.filter((friend) => friend.isActive).length;

  return (
    <FriendsScreen
      hasJoinedRoom={Boolean(currentUser.currentRoomCode)}
      roommate={
        roommate
          ? {
              id: roommate.id,
              displayName: roommate.displayName ?? defaultDisplayName(roommate.email),
            avatarPath: roommate.avatarPath,
              relationship: roommateRelationship,
            }
          : null
      }
      friends={friendItems}
      onlineCount={onlineCount}
    />
  );
}
