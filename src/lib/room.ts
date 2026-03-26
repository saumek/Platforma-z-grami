import { prisma } from "@/lib/prisma";

export function normalizeRoomCode(code: string) {
  return code.trim().replace(/^#/, "").toUpperCase();
}

export function formatRoomCode(code: string | null | undefined) {
  return code ? `#${code}` : "";
}

export async function roomHasCapacity(roomCode: string, userId?: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

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
