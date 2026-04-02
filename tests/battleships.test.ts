import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const txBattleshipGame = {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  };

  const prisma = {
    battleshipGame: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof tx) => unknown) => callback(tx)),
  };

  const tx = {
    battleshipGame: txBattleshipGame,
  };

  const pruneInactiveUsersFromRoom = vi.fn();

  return {
    prisma,
    txBattleshipGame,
    pruneInactiveUsersFromRoom,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/profile", () => ({
  defaultDisplayName: (email: string) => email.split("@")[0] ?? "Uzytkownik",
}));

vi.mock("@/lib/room-cleanup", () => ({
  pruneInactiveUsersFromRoom: mocks.pruneInactiveUsersFromRoom,
}));

import { shootBattleship, validatePlacement } from "@/lib/battleships";

describe("validatePlacement", () => {
  it("rejects invalid ship layouts", () => {
    expect(validatePlacement([[0, 1, 2], [5, 11], [12, 13]])).toBe(
      "Statek musi być ustawiony w linii prostej.",
    );
  });

  it("accepts a valid 3-2-2 layout", () => {
    expect(validatePlacement([[0, 1, 2], [5, 6], [10, 11]])).toBeNull();
  });
});

describe("shootBattleship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finishes the round and grants the room point on the last hit", async () => {
    const game = {
      id: "battle-1",
      version: 3,
      roomCode: "ROOM-1",
      status: "playing",
      isPaused: false,
      playerOneId: "user-1",
      playerTwoId: "user-2",
      currentTurnUserId: "user-1",
      playerOneShots: JSON.stringify([0, 1]),
      playerTwoShots: "[]",
      playerOneBoard: JSON.stringify([[5, 6, 7], [10, 11], [15, 16]]),
      playerTwoBoard: JSON.stringify([[0, 1, 2]]),
    };

    mocks.prisma.battleshipGame.findUnique.mockResolvedValueOnce(game);
    mocks.txBattleshipGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await shootBattleship("ROOM-1", "user-1", 2);

    expect(result).toEqual({
      success: true,
      message: "Trafiony. Wygrywasz rundę i dostajesz punkt ogólny pokoju!",
    });
    expect(mocks.txBattleshipGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "battle-1",
        version: 3,
        status: "playing",
        isPaused: false,
        currentTurnUserId: "user-1",
      },
      data: {
        playerOneShots: JSON.stringify([0, 1, 2]),
        playerOneScore: { increment: 1 },
        playerOneWins: { increment: 1 },
        status: "finished",
        currentTurnUserId: null,
        winnerId: "user-1",
        version: { increment: 1 },
      },
    });
  });
});
