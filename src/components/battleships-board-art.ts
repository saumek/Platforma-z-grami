import { BATTLESHIP_BOARD_SIZE, type BattleshipCellState } from "@/lib/battleships";

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

function normalizeShipCells(cells: number[]) {
  return [...cells].sort((left, right) => left - right);
}

function getRenderableShipOrientation(cells: number[]) {
  if (cells.length < 2) {
    return null;
  }

  const normalizedCells = normalizeShipCells(cells);
  const rows = normalizedCells.map((cell) => Math.floor(cell / BATTLESHIP_BOARD_SIZE));
  const columns = normalizedCells.map((cell) => cell % BATTLESHIP_BOARD_SIZE);
  const sameRow = rows.every((row) => row === rows[0]);
  const sameColumn = columns.every((column) => column === columns[0]);

  if (!sameRow && !sameColumn) {
    return null;
  }

  const step = sameRow ? 1 : BATTLESHIP_BOARD_SIZE;

  for (let index = 1; index < normalizedCells.length; index += 1) {
    if (normalizedCells[index]! - normalizedCells[index - 1]! !== step) {
      return null;
    }
  }

  return sameRow ? "horizontal" : "vertical";
}

export function getBattleshipShipCellArtMapFromShips(ships: number[][]) {
  const shipCellArtMap: Record<number, BattleshipShipCellArt> = {};

  ships.forEach((ship) => {
    const cells = normalizeShipCells(ship);
    const orientation = getRenderableShipOrientation(cells);

    if (!orientation) {
      return;
    }

    try {
      getBattleshipArtForLength(cells.length);
    } catch {
      return;
    }

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
