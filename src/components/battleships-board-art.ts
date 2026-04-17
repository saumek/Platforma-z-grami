import type { BattleshipCellState } from "@/lib/battleships";

export type BattleshipCellTone =
  | "water"
  | "available"
  | "ship"
  | "hit"
  | "miss"
  | "blocked";

export type BattleshipShipOrientation = "horizontal" | "vertical";

export type BattleshipShipCellArt = {
  length: number;
  orientation: BattleshipShipOrientation;
  segmentIndex: number;
};

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

export function getBattleshipShipCellArtLayout(cellArt: BattleshipShipCellArt) {
  return {
    ...getBattleshipArtForLength(cellArt.length),
    imageWidthPercent: cellArt.length * 100,
    imageOffsetPercent: cellArt.segmentIndex * 100,
    rotationDeg: cellArt.orientation === "vertical" ? 90 : 0,
    scale: cellArt.orientation === "vertical" ? 1.18 : 1,
  };
}

function getShipOrientation(cells: number[]): BattleshipShipOrientation {
  if (cells.length <= 1) {
    return "horizontal";
  }

  return cells[1]! - cells[0]! === 1 ? "horizontal" : "vertical";
}

function normalizeShipCells(cells: number[]) {
  return [...cells].sort((left, right) => left - right);
}

export function getBattleshipShipCellArtMapFromShips(ships: number[][]) {
  const shipCellArtMap: Record<number, BattleshipShipCellArt> = {};

  ships.forEach((ship) => {
    const cells = normalizeShipCells(ship);
    const orientation = getShipOrientation(cells);

    cells.forEach((cell, segmentIndex) => {
      shipCellArtMap[cell] = {
        length: cells.length,
        orientation,
        segmentIndex,
      };
    });
  });

  return shipCellArtMap;
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
