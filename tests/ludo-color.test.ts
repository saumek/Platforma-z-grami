import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findMany: vi.fn(),
    },
    ludoGame: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const pruneInactiveUsersFromRoom = vi.fn();

  return {
    prisma,
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

import { chooseLudoColor, moveLudoToken } from "@/lib/ludo";

describe("chooseLudoColor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "user1@example.com",
        displayName: "Uzytkownik 1",
        avatarPath: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      {
        id: "user-2",
        email: "user2@example.com",
        displayName: "Uzytkownik 2",
        avatarPath: null,
        createdAt: new Date("2024-01-01T00:00:01.000Z"),
      },
    ]);
  });

  it("allows choosing the first color while the opponent color is still null", async () => {
    const game = {
      id: "ludo-1",
      roomCode: "ROOM-1",
      version: 4,
      status: "color_selection",
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneColor: null,
      playerTwoColor: null,
      currentTurnUserId: null,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 5,
        playerOneColor: "green",
      });
    mocks.prisma.ludoGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await chooseLudoColor("ROOM-1", "user-1", "green");

    expect(result).toEqual({
      success: true,
      message: "Kolor został wybrany.",
    });
    expect(mocks.prisma.ludoGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ludo-1",
        version: 4,
        status: { not: "finished" },
        playerOneColor: null,
        playerTwoColor: null,
      },
      data: {
        playerOneColor: "green",
        version: { increment: 1 },
      },
    });
  });

  it("starts the game after the second player picks a different color", async () => {
    const game = {
      id: "ludo-2",
      roomCode: "ROOM-2",
      version: 7,
      status: "color_selection",
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneColor: "green",
      playerTwoColor: null,
      currentTurnUserId: null,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 8,
        playerTwoColor: "yellow",
      });
    mocks.prisma.ludoGame.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await chooseLudoColor("ROOM-2", "user-2", "yellow");

    expect(result).toEqual({
      success: true,
      message: "Kolor został wybrany.",
    });
    expect(mocks.prisma.ludoGame.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "ludo-2",
        version: 8,
        status: "color_selection",
      },
      data: {
        status: "playing",
        currentTurnUserId: "user-1",
        version: { increment: 1 },
      },
    });
  });
});

describe("moveLudoToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "user1@example.com",
        displayName: "Uzytkownik 1",
        avatarPath: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      {
        id: "user-2",
        email: "user2@example.com",
        displayName: "Uzytkownik 2",
        avatarPath: null,
        createdAt: new Date("2024-01-01T00:00:01.000Z"),
      },
    ]);
  });

  it("ends the game when the fourth token enters the last free home slot", async () => {
    const game = {
      id: "ludo-finish-1",
      roomCode: "ROOM-FINISH-1",
      version: 10,
      status: "playing",
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneColor: "green",
      playerTwoColor: "yellow",
      playerOneTokens: JSON.stringify([40, 41, 42, 37]),
      playerTwoTokens: JSON.stringify([-1, -1, -1, -1]),
      currentTurnUserId: "user-1",
      diceValue: 6,
      rewardGranted: false,
      isPaused: false,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game);
    mocks.prisma.ludoGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await moveLudoToken("ROOM-FINISH-1", "user-1", 3);

    expect(result).toEqual({
      success: true,
      message: "Partia zakończona zwycięstwem.",
    });
    expect(mocks.prisma.ludoGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ludo-finish-1",
        version: 10,
        status: "playing",
        isPaused: false,
        terminatedAt: null,
        currentTurnUserId: "user-1",
        diceValue: 6,
      },
      data: {
        playerOneTokens: JSON.stringify([40, 41, 42, 43]),
        playerTwoTokens: JSON.stringify([-1, -1, -1, -1]),
        playerOneRoomPoints: { increment: 1 },
        rewardGranted: true,
        diceValue: null,
        currentTurnUserId: null,
        status: "finished",
        winnerId: "user-1",
        version: { increment: 1 },
      },
    });
  });

  it("does not allow stacking two tokens on the same final home slot", async () => {
    const game = {
      id: "ludo-finish-2",
      roomCode: "ROOM-FINISH-2",
      version: 11,
      status: "playing",
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneColor: "green",
      playerTwoColor: "yellow",
      playerOneTokens: JSON.stringify([40, 41, 43, 37]),
      playerTwoTokens: JSON.stringify([-1, -1, -1, -1]),
      currentTurnUserId: "user-1",
      diceValue: 6,
      rewardGranted: false,
      isPaused: false,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game);

    const result = await moveLudoToken("ROOM-FINISH-2", "user-1", 3);

    expect(result).toEqual({
      success: false,
      message: "Ten pionek nie może się teraz ruszyć.",
    });
    expect(mocks.prisma.ludoGame.updateMany).not.toHaveBeenCalled();
  });
});
