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

function createUser(id: string, order: number) {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id.replace("user-", "Uzytkownik "),
    avatarPath: null,
    createdAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
  };
}

describe("chooseLudoColor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
    mocks.prisma.user.findMany.mockResolvedValue([
      createUser("user-1", 0),
      createUser("user-2", 1),
    ]);
  });

  it("allows choosing the first color while other players still have no color", async () => {
    const game = {
      id: "ludo-1",
      roomCode: "ROOM-1",
      version: 4,
      status: "color_selection",
      joinedPlayerIds: JSON.stringify(["user-1", "user-2"]),
      playerOrder: JSON.stringify(["user-1", "user-2"]),
      selectedColors: JSON.stringify({}),
      tokenProgresses: JSON.stringify({
        "user-1": [-1, -1, -1, -1],
        "user-2": [-1, -1, -1, -1],
      }),
      roomPointsByUser: JSON.stringify({}),
      currentTurnUserId: null,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique.mockResolvedValue(game);
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
      },
      data: expect.objectContaining({
        selectedColors: JSON.stringify({ "user-1": "green" }),
      }),
    });
  });

  it("starts the game after the second player picks a different color", async () => {
    const game = {
      id: "ludo-2",
      roomCode: "ROOM-2",
      version: 7,
      status: "color_selection",
      joinedPlayerIds: JSON.stringify(["user-1", "user-2"]),
      playerOrder: JSON.stringify(["user-1", "user-2"]),
      selectedColors: JSON.stringify({ "user-1": "green" }),
      tokenProgresses: JSON.stringify({
        "user-1": [-1, -1, -1, -1],
        "user-2": [-1, -1, -1, -1],
      }),
      roomPointsByUser: JSON.stringify({}),
      currentTurnUserId: null,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique.mockResolvedValue(game);
    mocks.prisma.ludoGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await chooseLudoColor("ROOM-2", "user-2", "yellow");

    expect(result).toEqual({
      success: true,
      message: "Kolor został wybrany.",
    });
    expect(mocks.prisma.ludoGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ludo-2",
        version: 7,
        status: { not: "finished" },
      },
      data: expect.objectContaining({
        status: "playing",
        currentTurnUserId: "user-1",
        selectedColors: JSON.stringify({ "user-1": "green", "user-2": "yellow" }),
      }),
    });
  });
});

describe("moveLudoToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
    mocks.prisma.user.findMany.mockResolvedValue([
      createUser("user-1", 0),
      createUser("user-2", 1),
    ]);
  });

  it("ends the game when the fourth token enters the last free home slot", async () => {
    const game = {
      id: "ludo-finish-1",
      roomCode: "ROOM-FINISH-1",
      version: 10,
      status: "playing",
      joinedPlayerIds: JSON.stringify(["user-1", "user-2"]),
      playerOrder: JSON.stringify(["user-1", "user-2"]),
      selectedColors: JSON.stringify({ "user-1": "green", "user-2": "yellow" }),
      tokenProgresses: JSON.stringify({
        "user-1": [40, 41, 42, 37],
        "user-2": [-1, -1, -1, -1],
      }),
      roomPointsByUser: JSON.stringify({}),
      currentTurnUserId: "user-1",
      diceValue: 6,
      isPaused: false,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique.mockResolvedValue(game);
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
      data: expect.objectContaining({
        status: "finished",
        winnerId: "user-1",
        currentTurnUserId: null,
      }),
    });
  });

  it("does not allow stacking two tokens on the same final home slot", async () => {
    const game = {
      id: "ludo-finish-2",
      roomCode: "ROOM-FINISH-2",
      version: 11,
      status: "playing",
      joinedPlayerIds: JSON.stringify(["user-1", "user-2"]),
      playerOrder: JSON.stringify(["user-1", "user-2"]),
      selectedColors: JSON.stringify({ "user-1": "green", "user-2": "yellow" }),
      tokenProgresses: JSON.stringify({
        "user-1": [40, 41, 43, 37],
        "user-2": [-1, -1, -1, -1],
      }),
      roomPointsByUser: JSON.stringify({}),
      currentTurnUserId: "user-1",
      diceValue: 6,
      isPaused: false,
      terminatedAt: null,
    };

    mocks.prisma.ludoGame.findUnique.mockResolvedValue(game);

    const result = await moveLudoToken("ROOM-FINISH-2", "user-1", 3);

    expect(result).toEqual({
      success: false,
      message: "Ten pionek nie może się teraz ruszyć.",
    });
    expect(mocks.prisma.ludoGame.updateMany).not.toHaveBeenCalled();
  });
});
