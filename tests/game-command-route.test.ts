import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getCurrentSession = vi.fn();
  const publishGameEvent = vi.fn();
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  return {
    getCurrentSession,
    publishGameEvent,
    prisma,
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/lib/game-events", () => ({
  publishGameEvent: mocks.publishGameEvent,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { runGameCommandRoute } from "@/lib/game-command-route";

describe("runGameCommandRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a room event and returns refreshed state after a successful command", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      currentRoomCode: "ROOM-1",
    });

    const response = await runGameCommandRoute({
      command: vi.fn().mockResolvedValue({
        success: true,
        message: "OK",
      }),
      getState: vi.fn().mockResolvedValue({
        status: "playing",
      }),
      errorMessage: "Boom",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "OK",
      state: {
        status: "playing",
      },
    });
    expect(mocks.publishGameEvent).toHaveBeenCalledWith("ROOM-1");
  });

  it("returns a 400 without publishing when the command fails", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      currentRoomCode: "ROOM-1",
    });

    const response = await runGameCommandRoute({
      command: vi.fn().mockResolvedValue({
        success: false,
        message: "Nope",
      }),
      errorMessage: "Boom",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "Nope",
    });
    expect(mocks.publishGameEvent).not.toHaveBeenCalled();
  });
});
