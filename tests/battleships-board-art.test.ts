import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/app-bottom-nav", () => ({
  AppBottomNav: () => null,
}));

vi.mock("@/components/game-header-shell", () => ({
  GameHeaderShell: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/game-reaction-drawer", () => ({
  GameReactionDrawer: () => null,
}));

vi.mock("@/components/use-game-state-sync", () => ({
  useGameStateSync: () => ({ state: null, setState: vi.fn(), refreshState: vi.fn() }),
}));

vi.mock("@/components/use-game-session-controls", () => ({
  useGameSessionControls: () => ({ overlay: null, pauseButtonVisible: false, pauseButtonDisabled: false }),
}));

import {
  getBattleshipArtForLength,
  getBattleshipCellTone,
  getBattleshipRenderableShipsFromShips,
  getBattleshipShipRenderLayout,
} from "@/components/battleships-board-art";
import { getSetupDisplayData } from "@/components/battleships-screen";

describe("getBattleshipArtForLength", () => {
  it("returns the generated 3-cell ship asset for the long ship", () => {
    expect(getBattleshipArtForLength(3)).toEqual({
      src: "/images/battleships/ship-3-generated.svg",
      alt: "Statek długości 3",
      width: 284,
      height: 96,
    });
  });

  it("returns the shared generated 2-cell ship asset for short ships", () => {
    expect(getBattleshipArtForLength(2)).toEqual({
      src: "/images/battleships/ship-2-generated.svg",
      alt: "Statek długości 2",
      width: 240,
      height: 96,
    });
  });

  it("throws for unsupported ship lengths", () => {
    expect(() => getBattleshipArtForLength(4)).toThrow(
      "Unsupported battleship length: 4",
    );
  });
});

describe("getBattleshipCellTone", () => {
  it("maps gameplay states to stable presentation tones", () => {
    expect(getBattleshipCellTone("empty")).toBe("water");
    expect(getBattleshipCellTone("available")).toBe("available");
    expect(getBattleshipCellTone("ship")).toBe("ship");
    expect(getBattleshipCellTone("hit")).toBe("hit");
    expect(getBattleshipCellTone("miss")).toBe("miss");
    expect(getBattleshipCellTone("blocked")).toBe("blocked");
  });

  it("throws for impossible cell states", () => {
    expect(() => getBattleshipCellTone("unknown" as never)).toThrow(
      "Unhandled battleship cell state: unknown",
    );
  });
});

describe("getBattleshipShipRenderLayout", () => {
  it("keeps horizontal ships on the shared asset without rotation", () => {
    expect(getBattleshipShipRenderLayout(3, "horizontal")).toMatchObject({
      src: "/images/battleships/ship-3-generated.svg",
      alt: "Statek długości 3",
      imageWidthPercent: 100,
      imageHeightPercent: 100,
      rotationDegrees: 0,
    });
  });

  it("uses the same asset for vertical ships and rotates it by 90 degrees", () => {
    expect(getBattleshipShipRenderLayout(3, "vertical")).toMatchObject({
      src: "/images/battleships/ship-3-generated.svg",
      alt: "Statek długości 3",
      imageWidthPercent: 300,
      imageHeightPercent: 100,
      rotationDegrees: 90,
    });
  });
});

describe("getBattleshipRenderableShipsFromShips", () => {
  it("maps direct ship placements to grid overlays", () => {
    expect(
      getBattleshipRenderableShipsFromShips([
        [0, 1, 2],
        [5, 10],
      ]),
    ).toEqual([
      {
        cells: [0, 1, 2],
        length: 3,
        orientation: "horizontal",
        startRow: 1,
        startColumn: 1,
        rowSpan: 1,
        columnSpan: 3,
      },
      {
        cells: [5, 10],
        length: 2,
        orientation: "vertical",
        startRow: 2,
        startColumn: 1,
        rowSpan: 2,
        columnSpan: 1,
      },
    ]);
  });

  it("preserves authoritative vertical ship groups with correct spans", () => {
    expect(
      getBattleshipRenderableShipsFromShips([
        [0, 5, 10],
        [1, 6],
        [15, 20],
      ]),
    ).toEqual([
      {
        cells: [0, 5, 10],
        length: 3,
        orientation: "vertical",
        startRow: 1,
        startColumn: 1,
        rowSpan: 3,
        columnSpan: 1,
      },
      {
        cells: [1, 6],
        length: 2,
        orientation: "vertical",
        startRow: 1,
        startColumn: 2,
        rowSpan: 2,
        columnSpan: 1,
      },
      {
        cells: [15, 20],
        length: 2,
        orientation: "vertical",
        startRow: 4,
        startColumn: 1,
        rowSpan: 2,
        columnSpan: 1,
      },
    ]);
  });

  it("ignores malformed or unsupported persisted ship groups safely", () => {
    expect(
      getBattleshipRenderableShipsFromShips([
        [0, 1, 2],
        [5, 11],
        [7],
        [15, 16, 17, 18],
      ]),
    ).toEqual([
      {
        cells: [0, 1, 2],
        length: 3,
        orientation: "horizontal",
        startRow: 1,
        startColumn: 1,
        rowSpan: 1,
        columnSpan: 3,
      },
    ]);
  });
});

describe("getSetupDisplayData", () => {
  it("uses authoritative saved ships and board cells when setup is locked", () => {
    const result = getSetupDisplayData({
      isSetupLocked: true,
      localPlacements: [null, null, null],
      ownBoard: [
        "ship", "ship", "empty", "empty", "empty",
        "empty", "empty", "empty", "empty", "empty",
        "ship", "empty", "empty", "empty", "empty",
        "ship", "ship", "empty", "empty", "empty",
        "empty", "empty", "empty", "empty", "empty",
      ],
      ownShips: [[0, 1], [10, 15], [16, 17]],
      shipLengths: [2, 2, 2],
    });

    expect(result.board[0]).toBe("ship");
    expect(result.board[10]).toBe("ship");
    expect(result.placements).toEqual([[0, 1], [10, 15], [16, 17]]);
  });
});
