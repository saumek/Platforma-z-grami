import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    room: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  const pruneInactiveUsersFromRoom = vi.fn();
  const resetRoomIfEmpty = vi.fn();

  return {
    prisma,
    tx,
    pruneInactiveUsersFromRoom,
    resetRoomIfEmpty,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/room-cleanup", () => ({
  pruneInactiveUsersFromRoom: mocks.pruneInactiveUsersFromRoom,
  resetRoomIfEmpty: mocks.resetRoomIfEmpty,
}));

import { assignUserToRoom } from "@/lib/room";

describe("assignUserToRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
    mocks.tx.room.upsert.mockResolvedValue({ code: "ROOM-1" });
  });

  it("allows the fourth user to join but rejects the fifth", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      currentRoomCode: null,
    });
    mocks.tx.user.update.mockResolvedValue({});

    mocks.tx.user.count.mockResolvedValueOnce(3);

    await expect(assignUserToRoom("user-4", "room-1")).resolves.toEqual({
      success: true,
      previousRoomCode: null,
      roomCode: "ROOM-1",
    });

    mocks.tx.user.count.mockResolvedValueOnce(4);

    await expect(assignUserToRoom("user-5", "room-1")).resolves.toEqual({
      success: false,
      previousRoomCode: null,
      roomCode: "ROOM-1",
      reason: "full",
    });
  });

  it("cleans the previous room after moving the user to a different room", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      currentRoomCode: "ROOM-OLD",
    });
    mocks.tx.user.count.mockResolvedValue(1);
    mocks.tx.user.update.mockResolvedValue({});

    await assignUserToRoom("user-1", "room-new");

    expect(mocks.resetRoomIfEmpty).toHaveBeenCalledWith("ROOM-OLD");
  });
});
