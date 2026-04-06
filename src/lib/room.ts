import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom, resetRoomIfEmpty } from "@/lib/room-cleanup";
import { normalizeRoomCode } from "@/lib/room-code";

type AssignUserToRoomResult =
  | {
      success: true;
      previousRoomCode: string | null;
      roomCode: string;
    }
  | {
      success: false;
      previousRoomCode: string | null;
      roomCode: string;
      reason: "full";
    };

export async function assignUserToRoom(userId: string, roomCode: string): Promise<AssignUserToRoomResult> {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  await pruneInactiveUsersFromRoom(normalizedRoomCode);

  const result = await prisma.$transaction(async (tx) => {
    // Force a write at the start of the transaction so joins to the same room serialize.
    await tx.room.upsert({
      where: { code: normalizedRoomCode },
      update: {},
      create: { code: normalizedRoomCode },
    });

    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { currentRoomCode: true },
    });

    if (!currentUser) {
      throw new Error("USER_NOT_FOUND");
    }

    if (currentUser.currentRoomCode === normalizedRoomCode) {
      return {
        success: true as const,
        previousRoomCode: currentUser.currentRoomCode,
      };
    }

    const roomUsersCount = await tx.user.count({
      where: { currentRoomCode: normalizedRoomCode },
    });

    if (roomUsersCount >= 4) {
      return {
        success: false as const,
        previousRoomCode: currentUser.currentRoomCode,
        reason: "full" as const,
      };
    }

    await tx.user.update({
      where: { id: userId },
      data: { currentRoomCode: normalizedRoomCode },
    });

    return {
      success: true as const,
      previousRoomCode: currentUser.currentRoomCode,
    };
  });

  const assignmentResult = {
    ...result,
    roomCode: normalizedRoomCode,
  };

  if (
    assignmentResult.success &&
    assignmentResult.previousRoomCode &&
    assignmentResult.previousRoomCode !== normalizedRoomCode
  ) {
    await resetRoomIfEmpty(assignmentResult.previousRoomCode);
  }

  return assignmentResult;
}
