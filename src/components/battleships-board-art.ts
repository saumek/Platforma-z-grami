import type { BattleshipCellState } from "@/lib/battleships";

export type BattleshipCellTone =
  | "water"
  | "available"
  | "ship"
  | "hit"
  | "miss"
  | "blocked";

function assertNever(value: never): never {
  throw new Error(`Unhandled battleship cell state: ${String(value)}`);
}

export function getBattleshipArtForLength(length: number) {
  if (length === 3) {
    return {
      src: "/images/battleships/ship-3.svg",
      alt: "Statek długości 3",
    };
  }

  if (length === 2) {
    return {
      src: "/images/battleships/ship-2.svg",
      alt: "Statek długości 2",
    };
  }

  throw new Error(`Unsupported battleship length: ${length}`);
}

export function getBattleshipCellTone(state: BattleshipCellState): BattleshipCellTone {
  switch (state) {
    case "empty":
      return "water";
    case "available":
      return "available";
    case "ship":
      return "ship";
    case "hit":
      return "hit";
    case "miss":
      return "miss";
    case "blocked":
      return "blocked";
    default:
      return assertNever(state);
  }
}
