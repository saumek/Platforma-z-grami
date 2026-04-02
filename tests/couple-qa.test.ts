import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    coupleQaGame: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

import { restartCoupleQaGame, submitCoupleQaAnswer } from "@/lib/couple-qa";

describe("submitCoupleQaAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a matched answer pair into a compatibility point", async () => {
    const game = {
      id: "couple-1",
      version: 5,
      roomCode: "ROOM-1",
      status: "question",
      isPaused: false,
      terminatedAt: null,
      playerOneId: "user-1",
      playerTwoId: "user-2",
      questionOrder: JSON.stringify([0, 1, 2]),
      roundIndex: 0,
      playerOneAnswer: 1,
      playerTwoAnswer: null,
      questionStartedAt: new Date(Date.now() + 60_000),
    };

    mocks.prisma.coupleQaGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 6,
        playerTwoAnswer: 1,
      });
    mocks.prisma.coupleQaGame.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await submitCoupleQaAnswer("ROOM-1", "user-2", 1);

    expect(result).toEqual({
      success: true,
      message: "Macie zgodność!",
    });
    expect(mocks.prisma.coupleQaGame.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "couple-1",
        version: 6,
        status: "question",
      },
      data: {
        status: "round_result",
        compatibilityScore: { increment: 1 },
        lastMatch: true,
        roundResolvedAt: expect.any(Date),
        version: { increment: 1 },
      },
    });
  });
});

describe("restartCoupleQaGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets the round state while keeping the game ready for both players", async () => {
    const game = {
      id: "couple-2",
      version: 9,
      roomCode: "ROOM-2",
      playerOneId: "user-1",
      playerTwoId: "user-2",
    };

    mocks.prisma.coupleQaGame.findUnique.mockResolvedValueOnce(game);
    mocks.prisma.coupleQaGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await restartCoupleQaGame("ROOM-2", "user-1");

    expect(result).toEqual({
      success: true,
      message: "Nowa seria pytań jest gotowa.",
    });
    expect(mocks.prisma.coupleQaGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "couple-2",
        version: 9,
      },
      data: expect.objectContaining({
        status: "question",
        compatibilityScore: 0,
        roundIndex: 0,
        playerOneAnswer: null,
        playerTwoAnswer: null,
        playerOneJoined: true,
        playerTwoJoined: true,
        rewardGranted: false,
        isPaused: false,
        terminatedAt: null,
        version: { increment: 1 },
      }),
    });
  });
});
