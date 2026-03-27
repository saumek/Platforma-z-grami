import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";
import { normalizeRoomCode } from "@/lib/room-code";

export async function roomHasCapacity(roomCode: string, userId?: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  await pruneInactiveUsersFromRoom(normalizedRoomCode);

  const roomUsers = await prisma.user.findMany({
    where: { currentRoomCode: normalizedRoomCode },
    select: { id: true },
    take: 3,
  });

  if (userId && roomUsers.some((user) => user.id === userId)) {
    return true;
  }

  return roomUsers.length < 2;
}
