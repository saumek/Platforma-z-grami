import { describe, expect, it } from "vitest";

import {
  getBattleshipArtForLength,
  getBattleshipCellTone,
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
