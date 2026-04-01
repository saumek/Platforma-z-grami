import { describe, expect, it, vi } from "vitest";

import {
  applyVersionedGameUpdate,
  isGameParticipant,
  runGameCommand,
} from "./game-command";

describe("runGameCommand", () => {
  it("normalizes the room code before loading game state", async () => {
    const loadGame = vi.fn(async () => ({ id: "game-1" }));
    const execute = vi.fn(async ({ normalizedRoomCode }: { normalizedRoomCode: string }) => ({
      success: true,
      message: normalizedRoomCode,
    }));

    const result = await runGameCommand({
      roomCode: " #ab12 ",
      loadGame,
      missingMessage: "missing",
      execute,
    });

    expect(loadGame).toHaveBeenCalledWith("AB12");
    expect(result).toEqual({ success: true, message: "AB12" });
  });

  it("returns the missing message when no game exists", async () => {
    const result = await runGameCommand({
      roomCode: "test",
      loadGame: async () => null,
      missingMessage: "Nie znaleziono gry.",
      execute: vi.fn(),
    });

    expect(result).toEqual({
      success: false,
      message: "Nie znaleziono gry.",
    });
  });

  it("provides a reusable stale result helper", async () => {
    const result = await runGameCommand({
      roomCode: "test",
      loadGame: async () => ({ id: "game-1" }),
      missingMessage: "missing",
      execute: async ({ staleResult }) => staleResult("stale"),
    });

    expect(result).toEqual({ success: false, message: "stale" });
  });
});

describe("isGameParticipant", () => {
  it("matches either player slot", () => {
    expect(
      isGameParticipant(
        { playerOneId: "user-1", playerTwoId: "user-2" },
        "user-1",
      ),
    ).toBe(true);
    expect(
      isGameParticipant(
        { playerOneId: "user-1", playerTwoId: "user-2" },
        "user-2",
      ),
    ).toBe(true);
    expect(
      isGameParticipant(
        { playerOneId: "user-1", playerTwoId: "user-2" },
        "user-3",
      ),
    ).toBe(false);
  });
});

describe("applyVersionedGameUpdate", () => {
  it("increments version and reports success when updateMany modifies a row", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));

    const result = await applyVersionedGameUpdate(
      { updateMany },
      { id: "game-1", version: 4 },
      { status: "playing" },
      { winnerId: "user-1" },
    );

    expect(result).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "game-1",
        version: 4,
        status: "playing",
      },
      data: {
        winnerId: "user-1",
        version: { increment: 1 },
      },
    });
  });

  it("reports failure when updateMany does not modify any row", async () => {
    const result = await applyVersionedGameUpdate(
      { updateMany: async () => ({ count: 0 }) },
      { id: "game-1", version: 4 },
      {},
      { status: "finished" },
    );

    expect(result).toBe(false);
  });
});
