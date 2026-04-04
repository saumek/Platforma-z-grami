import { prisma } from "@/lib/prisma";

export async function resetRoomIfEmpty(roomCode: string | null | undefined) {
  if (!roomCode) {
    return;
  }

  const activeUsers = await prisma.user.count({
    where: { currentRoomCode: roomCode },
  });

  if (activeUsers > 0) {
    return;
  }

  await prisma.$transaction([
    prisma.battleshipGame.deleteMany({
      where: { roomCode },
    }),
    prisma.coupleQaGame.deleteMany({
      where: { roomCode },
    }),
    prisma.scienceQuizGame.deleteMany({
      where: { roomCode },
    }),
    prisma.ludoGame.deleteMany({
      where: { roomCode },
    }),
    prisma.dopowiedzeniaGame.deleteMany({
      where: { roomCode },
    }),
    prisma.room.deleteMany({
      where: { code: roomCode },
    }),
  ]);
}

export async function removeUserFromRoom(userId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentRoomCode: true },
  });

  if (!currentUser?.currentRoomCode) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { currentRoomCode: null },
  });

  await resetRoomIfEmpty(currentUser.currentRoomCode);
}

export async function pruneInactiveUsersFromRoom(roomCode: string | null | undefined) {
  if (!roomCode) {
    return 0;
  }

  const roomUsers = await prisma.user.findMany({
    where: { currentRoomCode: roomCode },
    select: {
      id: true,
      sessions: {
        select: {
          expiresAt: true,
        },
      },
    },
  });

  const now = new Date();
  const inactiveUserIds = roomUsers
    .filter(
      (user) =>
        user.sessions.length === 0 ||
        user.sessions.every((session) => session.expiresAt <= now),
    )
    .map((user) => user.id);

  if (inactiveUserIds.length === 0) {
    return 0;
  }

  await prisma.user.updateMany({
    where: {
      id: {
        in: inactiveUserIds,
      },
    },
    data: {
      currentRoomCode: null,
    },
  });

  await resetRoomIfEmpty(roomCode);

  return inactiveUserIds.length;
}
