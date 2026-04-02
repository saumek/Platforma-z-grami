import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    scienceQuizGame: {
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

import { restartScienceQuiz, submitScienceQuizAnswer } from "@/lib/science-quiz";

describe("submitScienceQuizAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awards the point only to the player with the correct answer", async () => {
    const game = {
      id: "science-1",
      version: 2,
      roomCode: "ROOM-1",
      category: "matma",
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

    mocks.prisma.scienceQuizGame.findUnique
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce(game)
      .mockResolvedValueOnce({
        ...game,
        version: 3,
        playerTwoAnswer: 3,
      });
    mocks.prisma.scienceQuizGame.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await submitScienceQuizAnswer("ROOM-1", "user-2", 3);

    expect(result).toEqual({
      success: true,
      message: "Punkt wpada tylko jednej osobie.",
    });
    expect(mocks.prisma.scienceQuizGame.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "science-1",
        version: 3,
        status: "question",
      },
      data: {
        status: "round_result",
        playerOneScore: undefined,
        playerTwoScore: { increment: 1 },
        questionStartedAt: null,
        roundResolvedAt: expect.any(Date),
        version: { increment: 1 },
      },
    });
  });
});

describe("restartScienceQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("can reset the quiz to waiting so a new category can be started cleanly", async () => {
    const game = {
      id: "science-2",
      version: 11,
      roomCode: "ROOM-2",
      category: "geografia",
      playerOneId: "user-1",
      playerTwoId: "user-2",
    };

    mocks.prisma.scienceQuizGame.findUnique.mockResolvedValueOnce(game);
    mocks.prisma.scienceQuizGame.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await restartScienceQuiz("ROOM-2", "user-1", { resetToWaiting: true });

    expect(result).toEqual({
      success: true,
      message: "Nowy quiz jest gotowy.",
    });
    expect(mocks.prisma.scienceQuizGame.updateMany).toHaveBeenCalledWith({
      where: {
        id: "science-2",
        version: 11,
      },
      data: expect.objectContaining({
        status: "waiting",
        playerOneJoined: false,
        playerTwoJoined: false,
        playerOneScore: 0,
        playerTwoScore: 0,
        roundIndex: 0,
        playerOneAnswer: null,
        playerTwoAnswer: null,
        questionStartedAt: null,
        rewardGranted: false,
        version: { increment: 1 },
      }),
    });
  });
});
