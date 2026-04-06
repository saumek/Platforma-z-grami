import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findMany: vi.fn(),
    },
  };

  return { prisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { isUserWithinRoomPlayerLimit } from "@/lib/game-player-limit";

describe("isUserWithinRoomPlayerLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats only the first two room users as eligible for 2-player games", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);

    await expect(isUserWithinRoomPlayerLimit("ROOM-1", "user-2", 2)).resolves.toBe(true);
    await expect(isUserWithinRoomPlayerLimit("ROOM-1", "user-3", 2)).resolves.toBe(false);
  });
});
