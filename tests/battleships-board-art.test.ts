import { describe, expect, it } from "vitest";

import {
  getBattleshipArtForLength,
  getBattleshipCellTone,
  getBattleshipShipCellArtLayout,
  getBattleshipShipCellArtMapFromShips,
} from "@/components/battleships-board-art";

describe("getBattleshipArtForLength", () => {
  it("returns the 3-cell ship asset for the long ship", () => {
    expect(getBattleshipArtForLength(3)).toEqual({
      src: "/images/battleships/ship-3.svg",
      alt: "Statek długości 3",
    });
  });

  it("returns the shared 2-cell ship asset for short ships", () => {
    expect(getBattleshipArtForLength(2)).toEqual({
      src: "/images/battleships/ship-2.svg",
      alt: "Statek długości 2",
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

describe("getBattleshipShipCellArtLayout", () => {
  it("keeps horizontal ship slices unrotated", () => {
    expect(
      getBattleshipShipCellArtLayout({
        length: 3,
        orientation: "horizontal",
        segmentIndex: 1,
      }),
    ).toMatchObject({
      src: "/images/battleships/ship-3.svg",
      alt: "Statek długości 3",
      imageWidthPercent: 300,
      imageOffsetPercent: 100,
      rotationDeg: 0,
      scale: 1,
    });
  });

  it("rotates vertical ship slices without changing the source asset", () => {
    expect(
      getBattleshipShipCellArtLayout({
        length: 2,
        orientation: "vertical",
        segmentIndex: 0,
      }),
    ).toMatchObject({
      src: "/images/battleships/ship-2.svg",
      alt: "Statek długości 2",
      imageWidthPercent: 200,
      imageOffsetPercent: 0,
      rotationDeg: 90,
    });
  });
});

describe("getBattleshipShipCellArtMapFromShips", () => {
  it("maps direct ship placements to ordered cell metadata", () => {
    expect(
      getBattleshipShipCellArtMapFromShips([
        [0, 1, 2],
        [5, 10],
      ]),
    ).toEqual({
      0: { length: 3, orientation: "horizontal", segmentIndex: 0 },
      1: { length: 3, orientation: "horizontal", segmentIndex: 1 },
      2: { length: 3, orientation: "horizontal", segmentIndex: 2 },
      5: { length: 2, orientation: "vertical", segmentIndex: 0 },
      10: { length: 2, orientation: "vertical", segmentIndex: 1 },
    });
  });
  
  it("preserves touching-ship orientation when authoritative groups are provided", () => {
    expect(
      getBattleshipShipCellArtMapFromShips([
        [0, 5, 10],
        [1, 6],
        [15, 20],
      ]),
    ).toEqual({
      0: { length: 3, orientation: "vertical", segmentIndex: 0 },
      5: { length: 3, orientation: "vertical", segmentIndex: 1 },
      10: { length: 3, orientation: "vertical", segmentIndex: 2 },
      1: { length: 2, orientation: "vertical", segmentIndex: 0 },
      6: { length: 2, orientation: "vertical", segmentIndex: 1 },
      15: { length: 2, orientation: "vertical", segmentIndex: 0 },
      20: { length: 2, orientation: "vertical", segmentIndex: 1 },
    });
  });
});
