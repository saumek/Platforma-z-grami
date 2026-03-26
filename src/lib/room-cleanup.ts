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
  ]);
}
