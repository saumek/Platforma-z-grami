import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    dopowiedzeniaGame: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
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

import {
  getDopowiedzeniaState,
  startDopowiedzeniaGame,
  submitDopowiedzeniaText,
} from "@/lib/dopowiedzenia";

function createUser(id: string, order: number) {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id.replace("user-", "Uzytkownik "),
    avatarPath: null,
    createdAt: new Date(`2024-01-01T00:00:0${order}.000Z`),
  };
}

describe("dopowiedzenia flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
  });

  it("keeps existing participant and allows the second user to join without rejoining first", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      createUser("user-1", 0),
      createUser("user-2", 1),
    ]);

    const game = {
      id: "dop-1",
      roomCode: "ROOM-1",
      version: 3,
      status: "waiting",
      joinedPlayerIds: JSON.stringify(["user-1"]),
      playerOrder: JSON.stringify(["user-1"]),
      stories: JSON.stringify({}),
      submissions: JSON.stringify({}),
      terminatedAt: null,
    };

    mocks.prisma.dopowiedzeniaGame.findUnique.mockResolvedValue(game);
    mocks.prisma.dopowiedzeniaGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await startDopowiedzeniaGame("ROOM-1", "user-2");

    expect(result).toEqual({
      success: true,
      message: "Można zaczynać historię.",
    });
    expect(mocks.prisma.dopowiedzeniaGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "dop-1",
        version: 3,
      },
      data: expect.objectContaining({
        joinedPlayerIds: JSON.stringify(["user-1", "user-2"]),
        playerOrder: JSON.stringify(["user-1", "user-2"]),
        status: "writing",
      }),
    });
  });

  it("passes continuations in a circle for four players", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      createUser("user-1", 0),
      createUser("user-2", 1),
      createUser("user-3", 2),
      createUser("user-4", 3),
    ]);

    const game = {
      id: "dop-2",
      roomCode: "ROOM-2",
      version: 5,
      status: "writing",
      isPaused: false,
      terminatedAt: null,
      roundIndex: 1,
      joinedPlayerIds: JSON.stringify(["user-1", "user-2", "user-3", "user-4"]),
      playerOrder: JSON.stringify(["user-1", "user-2", "user-3", "user-4"]),
      stories: JSON.stringify({
        "user-1": "Historia A start",
        "user-2": "Historia B start",
        "user-3": "Historia C start",
        "user-4": "Historia D start",
      }),
      submissions: JSON.stringify({
        "user-1": "dopisek od jeden prowadził wszystkich przez stare kino",
        "user-2": "dopisek od dwa rozświetlił nocne schody przy rynku",
        "user-3": "dopisek od trzy otworzył tajemniczą szafę za sceną",
      }),
    };

    mocks.prisma.dopowiedzeniaGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 6,
        submissions: JSON.stringify({
          "user-1": "dopisek od jeden prowadził wszystkich przez stare kino",
          "user-2": "dopisek od dwa rozświetlił nocne schody przy rynku",
          "user-3": "dopisek od trzy otworzył tajemniczą szafę za sceną",
          "user-4": "dopisek od cztery zatrzymał zegary w całym ratuszu",
        }),
      });
    mocks.prisma.dopowiedzeniaGame.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await submitDopowiedzeniaText(
      "ROOM-2",
      "user-4",
      "dopisek od cztery zatrzymał zegary w całym ratuszu",
    );

    expect(result).toEqual({
      success: true,
      message: "Nowa podpowiedź jest gotowa.",
    });
    expect(mocks.prisma.dopowiedzeniaGame.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "dop-2",
        version: 6,
        status: "writing",
      },
      data: expect.objectContaining({
        status: "reveal",
        stories: JSON.stringify({
          "user-1": "Historia A start dopisek od cztery zatrzymał zegary w całym ratuszu",
          "user-2": "Historia B start dopisek od jeden prowadził wszystkich przez stare kino",
          "user-3": "Historia C start dopisek od dwa rozświetlił nocne schody przy rynku",
          "user-4": "Historia D start dopisek od trzy otworzył tajemniczą szafę za sceną",
        }),
      }),
    });
  });

  it("rotates prompt owners from player to player on later rounds", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      createUser("user-1", 0),
      createUser("user-2", 1),
      createUser("user-3", 2),
      createUser("user-4", 3),
    ]);

    const game = {
      id: "dop-3",
      roomCode: "ROOM-3",
      status: "writing",
      version: 8,
      roundIndex: 2,
      joinedPlayerIds: JSON.stringify(["user-1", "user-2", "user-3", "user-4"]),
      playerOrder: JSON.stringify(["user-1", "user-2", "user-3", "user-4"]),
      stories: JSON.stringify({
        "user-1": "Historia A dostała nowy zwrot",
        "user-2": "Historia B pachniała kawą z rana",
        "user-3": "Historia C uciekła nagle w ciemność",
        "user-4": "Historia D zatańczyła pod neonami",
      }),
      submissions: JSON.stringify({}),
      roundResolvedAt: null,
      isPaused: false,
      pausedAt: null,
      pauseRequestedById: null,
      exitRequestedById: null,
      terminatedAt: null,
      terminationReason: null,
    };

    mocks.prisma.dopowiedzeniaGame.findUnique.mockResolvedValue(game);

    const playerOneState = await getDopowiedzeniaState("ROOM-3", "user-1");
    const playerFourState = await getDopowiedzeniaState("ROOM-3", "user-4");

    expect(playerOneState?.promptWords).toEqual(["uciekła", "nagle", "w", "ciemność"].slice(-3));
    expect(playerOneState?.promptSourceName).toBe("Uzytkownik 3");
    expect(playerFourState?.promptWords).toEqual(["pachniała", "kawą", "z", "rana"].slice(-3));
    expect(playerFourState?.promptSourceName).toBe("Uzytkownik 2");
  });
});
