import { BATTLESHIP_BOARD_SIZE, type BattleshipCellState } from "@/lib/battleships";

export type BattleshipCellTone =
  | "water"
  | "available"
  | "ship"
  | "hit"
  | "miss"
  | "blocked";

export type BattleshipShipOrientation = "horizontal" | "vertical";

export type BattleshipShipRenderLayout = {
  src: string;
  alt: string;
  width: number;
  height: number;
  imageWidthPercent: number;
  imageHeightPercent: number;
  rotationDegrees: number;
};

export type BattleshipRenderableShip = {
  cells: number[];
  length: number;
  orientation: BattleshipShipOrientation;
  startRow: number;
  startColumn: number;
  rowSpan: number;
  columnSpan: number;
};

type BattleshipArtAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

function assertNever(value: never): never {
  throw new Error(`Unhandled battleship cell state: ${String(value)}`);
}

export function getBattleshipArtForLength(length: number): BattleshipArtAsset {
  if (length === 3) {
    return {
      src: "/images/battleships/ship-3-generated.svg",
      alt: "Statek długości 3",
      width: 284,
      height: 96,
    };
  }

  if (length === 2) {
    return {
      src: "/images/battleships/ship-2-generated.svg",
      alt: "Statek długości 2",
      width: 240,
      height: 96,
    };
  }

  throw new Error(`Unsupported battleship length: ${length}`);
}

export function getBattleshipShipRenderLayout(
  length: number,
  orientation: BattleshipShipOrientation,
): BattleshipShipRenderLayout {
  const asset = getBattleshipArtForLength(length);

  return {
    ...asset,
    imageWidthPercent: orientation === "vertical" ? length * 100 : 100,
    imageHeightPercent: 100,
    rotationDegrees: orientation === "vertical" ? 90 : 0,
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

export function getBattleshipRenderableShipsFromShips(ships: number[][]) {
  const renderableShips: BattleshipRenderableShip[] = [];

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

    const startCell = cells[0]!;

    renderableShips.push({
      cells,
      length: cells.length,
      orientation,
      startRow: Math.floor(startCell / BATTLESHIP_BOARD_SIZE) + 1,
      startColumn: (startCell % BATTLESHIP_BOARD_SIZE) + 1,
      rowSpan: orientation === "vertical" ? cells.length : 1,
      columnSpan: orientation === "horizontal" ? cells.length : 1,
    });
  });

  return renderableShips;
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
