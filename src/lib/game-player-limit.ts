import { prisma } from "@/lib/prisma";

export async function isUserWithinRoomPlayerLimit(
  roomCode: string,
  userId: string,
  maxPlayers: number,
) {
  const eligibleUsers = await prisma.user.findMany({
    where: { currentRoomCode: roomCode },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: maxPlayers,
  });

  return eligibleUsers.some((user) => user.id === userId);
}
