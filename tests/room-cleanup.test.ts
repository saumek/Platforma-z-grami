import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    battleshipGame: {
      deleteMany: vi.fn(),
    },
    coupleQaGame: {
      deleteMany: vi.fn(),
    },
    scienceQuizGame: {
      deleteMany: vi.fn(),
    },
    ludoGame: {
      deleteMany: vi.fn(),
    },
    dopowiedzeniaGame: {
      deleteMany: vi.fn(),
    },
    room: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (operations: unknown[]) => operations),
  };

  return { prisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { removeUserFromRoom, resetRoomIfEmpty } from "@/lib/room-cleanup";

describe("room cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the room still has active users", async () => {
    mocks.prisma.user.count.mockResolvedValue(1);

    await resetRoomIfEmpty("ROOM-1");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.battleshipGame.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.room.deleteMany).not.toHaveBeenCalled();
  });

  it("removes all room records when the room becomes empty", async () => {
    mocks.prisma.user.count.mockResolvedValue(0);

    await resetRoomIfEmpty("ROOM-2");

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.battleshipGame.deleteMany).toHaveBeenCalledWith({
      where: { roomCode: "ROOM-2" },
    });
    expect(mocks.prisma.coupleQaGame.deleteMany).toHaveBeenCalledWith({
      where: { roomCode: "ROOM-2" },
    });
    expect(mocks.prisma.scienceQuizGame.deleteMany).toHaveBeenCalledWith({
      where: { roomCode: "ROOM-2" },
    });
    expect(mocks.prisma.ludoGame.deleteMany).toHaveBeenCalledWith({
      where: { roomCode: "ROOM-2" },
    });
    expect(mocks.prisma.dopowiedzeniaGame.deleteMany).toHaveBeenCalledWith({
      where: { roomCode: "ROOM-2" },
    });
    expect(mocks.prisma.room.deleteMany).toHaveBeenCalledWith({
      where: { code: "ROOM-2" },
    });
  });

  it("removes the user from the room and triggers cleanup when they were the last member", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      currentRoomCode: "ROOM-3",
    });
    mocks.prisma.user.count.mockResolvedValue(0);

    await removeUserFromRoom("user-3");

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-3" },
      data: { currentRoomCode: null },
    });
    expect(mocks.prisma.room.deleteMany).toHaveBeenCalledWith({
      where: { code: "ROOM-3" },
    });
  });
});
