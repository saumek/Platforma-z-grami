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

import { getBattleshipState, shootBattleship, validatePlacement } from "@/lib/battleships";

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

describe("getBattleshipState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps authoritative own board and ship groups during locked setup", async () => {
    mocks.prisma.battleshipGame.findUnique
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
      })
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
        status: "setup",
        playerOneId: "user-1",
        playerTwoId: "user-2",
        playerOneReady: true,
        playerTwoReady: false,
        playerOneScore: 0,
        playerTwoScore: 0,
        playerOneWins: 0,
        playerTwoWins: 0,
        playerOneShots: "[]",
        playerTwoShots: "[]",
        playerOneBoard: JSON.stringify([[0, 1, 2], [5, 10], [15, 20]]),
        playerTwoBoard: null,
        currentTurnUserId: null,
        winnerId: null,
        isPaused: false,
        pauseRequestedById: null,
        exitRequestedById: null,
        terminationReason: null,
        playerOne: {
          id: "user-1",
          email: "one@example.com",
          displayName: "One",
          avatarPath: null,
        },
        playerTwo: {
          id: "user-2",
          email: "two@example.com",
          displayName: "Two",
          avatarPath: null,
        },
      });

    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "one@example.com",
        displayName: "One",
        avatarPath: null,
        createdAt: new Date("2025-01-01"),
        currentRoomCode: "ROOM-1",
      },
      {
        id: "user-2",
        email: "two@example.com",
        displayName: "Two",
        avatarPath: null,
        createdAt: new Date("2025-01-02"),
        currentRoomCode: "ROOM-1",
      },
    ]);

    const state = await getBattleshipState("ROOM-1", "user-1");

    expect(state?.currentPlayer?.ready).toBe(true);
    expect(state?.ownShips).toEqual([[0, 1, 2], [5, 10], [15, 20]]);
    expect(state?.ownBoard[0]).toBe("ship");
    expect(state?.ownBoard[10]).toBe("ship");
  });

  it("returns authoritative ship groups for the current player and only reveals the opponent after finish", async () => {
    mocks.prisma.battleshipGame.findUnique
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
      })
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
        status: "playing",
        playerOneId: "user-1",
        playerTwoId: "user-2",
        playerOneReady: true,
        playerTwoReady: true,
        playerOneScore: 0,
        playerTwoScore: 0,
        playerOneWins: 0,
        playerTwoWins: 0,
        playerOneShots: JSON.stringify([0, 5, 10]),
        playerTwoShots: JSON.stringify([1, 6]),
        playerOneBoard: JSON.stringify([[0, 5, 10], [1, 6], [15, 20]]),
        playerTwoBoard: JSON.stringify([[2, 3, 4], [7, 12], [18, 23]]),
        currentTurnUserId: "user-1",
        winnerId: null,
        isPaused: false,
        pauseRequestedById: null,
        exitRequestedById: null,
        terminationReason: null,
        playerOne: {
          id: "user-1",
          email: "one@example.com",
          displayName: "One",
          avatarPath: null,
        },
        playerTwo: {
          id: "user-2",
          email: "two@example.com",
          displayName: "Two",
          avatarPath: null,
        },
      })
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
      })
      .mockResolvedValueOnce({
        roomCode: "ROOM-1",
        status: "finished",
        playerOneId: "user-1",
        playerTwoId: "user-2",
        playerOneReady: true,
        playerTwoReady: true,
        playerOneScore: 3,
        playerTwoScore: 0,
        playerOneWins: 1,
        playerTwoWins: 0,
        playerOneShots: JSON.stringify([2, 3, 4, 7, 12, 18, 23]),
        playerTwoShots: JSON.stringify([0, 5, 10, 1, 6, 15, 20]),
        playerOneBoard: JSON.stringify([[0, 5, 10], [1, 6], [15, 20]]),
        playerTwoBoard: JSON.stringify([[2, 3, 4], [7, 12], [18, 23]]),
        currentTurnUserId: null,
        winnerId: "user-1",
        isPaused: false,
        pauseRequestedById: null,
        exitRequestedById: null,
        terminationReason: null,
        playerOne: {
          id: "user-1",
          email: "one@example.com",
          displayName: "One",
          avatarPath: null,
        },
        playerTwo: {
          id: "user-2",
          email: "two@example.com",
          displayName: "Two",
          avatarPath: null,
        },
      });

    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "one@example.com",
        displayName: "One",
        avatarPath: null,
        createdAt: new Date("2025-01-01"),
        currentRoomCode: "ROOM-1",
      },
      {
        id: "user-2",
        email: "two@example.com",
        displayName: "Two",
        avatarPath: null,
        createdAt: new Date("2025-01-02"),
        currentRoomCode: "ROOM-1",
      },
    ]);

    const playingState = await getBattleshipState("ROOM-1", "user-1");
    const finishedState = await getBattleshipState("ROOM-1", "user-1");

    expect(playingState?.ownShips).toEqual([[0, 5, 10], [1, 6], [15, 20]]);
    expect(playingState?.revealedOpponentShips).toEqual([]);
    expect(finishedState?.revealedOpponentShips).toEqual([[2, 3, 4], [7, 12], [18, 23]]);
  });
});
