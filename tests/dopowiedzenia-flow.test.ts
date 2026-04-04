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
  ensureDopowiedzeniaGame,
  getDopowiedzeniaState,
  submitDopowiedzeniaText,
} from "@/lib/dopowiedzenia";

describe("dopowiedzenia flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pruneInactiveUsersFromRoom.mockResolvedValue(undefined);
  });

  it("keeps the first player's joined flag when the second player enters later", async () => {
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

    mocks.prisma.dopowiedzeniaGame.findUnique.mockResolvedValueOnce({
      id: "dop-1",
      roomCode: "ROOM-1",
      status: "waiting",
      playerOneId: "user-1",
      playerTwoId: null,
      playerOneJoined: true,
      playerTwoJoined: false,
      terminatedAt: null,
    });
    mocks.prisma.dopowiedzeniaGame.update.mockResolvedValue({
      id: "dop-1",
      roomCode: "ROOM-1",
      status: "waiting",
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneJoined: true,
      playerTwoJoined: false,
    });

    await ensureDopowiedzeniaGame("ROOM-1");

    expect(mocks.prisma.dopowiedzeniaGame.update).toHaveBeenCalledWith({
      where: { id: "dop-1" },
      data: expect.objectContaining({
        playerOneId: "user-1",
        playerTwoId: "user-2",
        playerOneJoined: true,
        playerTwoJoined: false,
      }),
    });
  });

  it("appends each continuation to the other player's story", async () => {
    const game = {
      id: "dop-2",
      roomCode: "ROOM-2",
      version: 5,
      status: "writing",
      isPaused: false,
      terminatedAt: null,
      playerOneId: "user-1",
      playerTwoId: "user-2",
      roundIndex: 1,
      playerOneStory: "Pierwsza historia zaczęła się bardzo spokojnie",
      playerTwoStory: "Druga historia pachniała dymem i lawendą",
      playerOneSubmission: "i nagle zgasły wszystkie latarnie w mieście",
      playerTwoSubmission: null,
    };

    mocks.prisma.dopowiedzeniaGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 6,
        playerTwoSubmission: "a potem z sufitu spadł wielki tort weselny",
      });
    mocks.prisma.dopowiedzeniaGame.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await submitDopowiedzeniaText(
      "ROOM-2",
      "user-2",
      "a potem z sufitu spadł wielki tort weselny",
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
      data: {
        status: "reveal",
        playerOneStory:
          "Pierwsza historia zaczęła się bardzo spokojnie a potem z sufitu spadł wielki tort weselny",
        playerTwoStory:
          "Druga historia pachniała dymem i lawendą i nagle zgasły wszystkie latarnie w mieście",
        playerOneSubmission: null,
        playerTwoSubmission: null,
        roundResolvedAt: expect.any(Date),
        version: { increment: 1 },
      },
    });
  });

  it("alternates the visible story between players on consecutive continuation rounds", async () => {
    const game = {
      id: "dop-3",
      roomCode: "ROOM-3",
      status: "writing",
      version: 8,
      roundIndex: 2,
      playerOneId: "user-1",
      playerTwoId: "user-2",
      playerOneStory: "Historia A dostała właśnie dopisek od użytkownika B",
      playerTwoStory: "Historia B dostała właśnie dopisek od użytkownika A",
      playerOneSubmission: null,
      playerTwoSubmission: null,
      roundResolvedAt: null,
      isPaused: false,
      pausedAt: null,
      pauseRequestedById: null,
      exitRequestedById: null,
      terminatedAt: null,
      terminationReason: null,
      playerOne: {
        id: "user-1",
        email: "user1@example.com",
        displayName: "Uzytkownik 1",
        avatarPath: null,
      },
      playerTwo: {
        id: "user-2",
        email: "user2@example.com",
        displayName: "Uzytkownik 2",
        avatarPath: null,
      },
    };

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
    mocks.prisma.dopowiedzeniaGame.findUnique.mockResolvedValue(game);

    const playerOneState = await getDopowiedzeniaState("ROOM-3", "user-1");
    const playerTwoState = await getDopowiedzeniaState("ROOM-3", "user-2");

    expect(playerOneState?.promptWords).toEqual(["dopisek", "od", "użytkownika", "B"].slice(-3));
    expect(playerTwoState?.promptWords).toEqual(["dopisek", "od", "użytkownika", "A"].slice(-3));
  });
});
