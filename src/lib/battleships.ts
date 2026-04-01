import {
  applyVersionedGameUpdate,
  isGameParticipant,
  runGameCommand,
} from "@/lib/game-command";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

export const BATTLESHIP_BOARD_SIZE = 5;
export const BATTLESHIP_SHIP_LENGTHS = [3, 2, 2] as const;
const BATTLESHIP_CELL_COUNT = BATTLESHIP_BOARD_SIZE * BATTLESHIP_BOARD_SIZE;

export type BattleshipStatus = "waiting" | "setup" | "playing" | "finished";
export type BattleshipCellState = "empty" | "ship" | "hit" | "miss" | "available" | "blocked";

type PlayerSummary = {
  id: string;
  name: string;
  avatarPath: string | null;
  ready: boolean;
  score: number;
  wins: number;
};

export type BattleshipState = {
  roomCode: string;
  status: BattleshipStatus;
  currentUserId: string;
  currentPlayer: PlayerSummary | null;
  opponent: PlayerSummary | null;
  readyCount: number;
  boardSize: number;
  shipLengths: number[];
  ownBoard: BattleshipCellState[];
  opponentBoard: BattleshipCellState[];
  isCurrentUserTurn: boolean;
  winnerId: string | null;
  isPaused: boolean;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

function normalizeBoard(board: number[][]) {
  return board
    .map((ship) => [...ship].sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!);
}

function parseBoard(value: string | null | undefined) {
  if (!value) {
    return [] as number[][];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((ship): ship is number[] => Array.isArray(ship))
      .map((ship) =>
        ship
          .filter((cell): cell is number => Number.isInteger(cell))
          .filter((cell) => cell >= 0 && cell < BATTLESHIP_CELL_COUNT),
      )
      .filter((ship) => ship.length > 0);
  } catch {
    return [];
  }
}

function parseShots(value: string | null | undefined) {
  if (!value) {
    return [] as number[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((cell): cell is number => Number.isInteger(cell))
      .filter((cell) => cell >= 0 && cell < BATTLESHIP_CELL_COUNT);
  } catch {
    return [];
  }
}

function validateShip(ship: number[]) {
  if (ship.length <= 1) {
    return true;
  }

  const rows = ship.map((cell) => Math.floor(cell / BATTLESHIP_BOARD_SIZE));
  const cols = ship.map((cell) => cell % BATTLESHIP_BOARD_SIZE);
  const sameRow = rows.every((row) => row === rows[0]);
  const sameColumn = cols.every((col) => col === cols[0]);

  if (!sameRow && !sameColumn) {
    return false;
  }

  const sorted = [...ship].sort((a, b) => a - b);
  const step = sameRow ? 1 : BATTLESHIP_BOARD_SIZE;

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! - sorted[index - 1]! !== step) {
      return false;
    }
  }

  return true;
}

export function validatePlacement(board: number[][]) {
  if (board.length !== BATTLESHIP_SHIP_LENGTHS.length) {
    return "Musisz ustawić wszystkie statki.";
  }

  const lengths = [...board].map((ship) => ship.length).sort((a, b) => a - b);
  const expected = [...BATTLESHIP_SHIP_LENGTHS].sort((a, b) => a - b);

  for (let index = 0; index < expected.length; index += 1) {
    if (lengths[index] !== expected[index]) {
      return "Statki mają zły rozmiar.";
    }
  }

  const occupied = new Set<number>();

  for (const ship of board) {
    if (!validateShip(ship)) {
      return "Statek musi być ustawiony w linii prostej.";
    }

    for (const cell of ship) {
      if (occupied.has(cell)) {
        return "Statki nie mogą nachodzić na siebie.";
      }

      occupied.add(cell);
    }
  }

  return null;
}

async function getRoomPlayers(roomCode: string) {
  await pruneInactiveUsersFromRoom(roomCode);

  return prisma.user.findMany({
    where: { currentRoomCode: roomCode },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarPath: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
}

function getName(user: { email: string; displayName: string | null }) {
  return user.displayName ?? defaultDisplayName(user.email);
}

function getPausedName(
  requestedById: string | null,
  players: {
    playerOneId: string | null;
    playerTwoId: string | null;
    playerOne?: { email: string; displayName: string | null } | null;
    playerTwo?: { email: string; displayName: string | null } | null;
  },
) {
  if (!requestedById) {
    return null;
  }

  if (requestedById === players.playerOneId && players.playerOne) {
    return getName(players.playerOne);
  }

  if (requestedById === players.playerTwoId && players.playerTwo) {
    return getName(players.playerTwo);
  }

  return "Drugi gracz";
}

function buildOwnBoard(board: number[][], opponentShots: number[]) {
  const shipCells = new Set(board.flat());

  return Array.from({ length: BATTLESHIP_CELL_COUNT }, (_, index) => {
    if (opponentShots.includes(index)) {
      return shipCells.has(index) ? "hit" : "miss";
    }

    return shipCells.has(index) ? "ship" : "empty";
  }) satisfies BattleshipCellState[];
}

function buildOpponentBoard(board: number[][], shots: number[], isTurn: boolean, isFinished: boolean) {
  const shipCells = new Set(board.flat());

  return Array.from({ length: BATTLESHIP_CELL_COUNT }, (_, index) => {
    if (shots.includes(index)) {
      return shipCells.has(index) ? "hit" : "miss";
    }

    if (isFinished && shipCells.has(index)) {
      return "ship";
    }

    return isTurn ? "available" : "blocked";
  }) satisfies BattleshipCellState[];
}

export async function ensureBattleshipGame(
  roomCode: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;
  const nextStatus: BattleshipStatus = roomPlayers.length < 2 ? "waiting" : "setup";

  const existing = await prisma.battleshipGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.battleshipGame.create({
      data: {
        roomCode,
        status: nextStatus,
        playerOneId,
        playerTwoId,
      },
    });
  }

  const playersChanged =
    existing.playerOneId !== playerOneId || existing.playerTwoId !== playerTwoId;

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.battleshipGame.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        playerOneId,
        playerTwoId,
        playerOneReady: false,
        playerTwoReady: false,
        playerOneBoard: null,
        playerTwoBoard: null,
        playerOneScore: 0,
        playerTwoScore: 0,
        playerOneShots: "[]",
        playerTwoShots: "[]",
        currentTurnUserId: null,
        winnerId: null,
        isPaused: false,
        pausedAt: null,
        pauseRequestedById: null,
        exitRequestedById: null,
        terminatedAt: null,
        terminationReason: null,
      },
    });
  }

  if (!playersChanged) {
    return existing;
  }

  return prisma.battleshipGame.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      playerOneId,
      playerTwoId,
      ...(playersChanged
        ? {
            playerOneReady: false,
            playerTwoReady: false,
            playerOneBoard: null,
            playerTwoBoard: null,
            playerOneScore: 0,
            playerTwoScore: 0,
            playerOneShots: "[]",
            playerTwoShots: "[]",
            currentTurnUserId: null,
            winnerId: null,
            isPaused: false,
            pausedAt: null,
            pauseRequestedById: null,
            exitRequestedById: null,
            terminatedAt: null,
            terminationReason: null,
          }
        : {}),
    },
  });
}

export async function getBattleshipState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureBattleshipGame(roomCode, options);

  const game = await prisma.battleshipGame.findUnique({
    where: { roomCode },
    include: {
      playerOne: {
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarPath: true,
        },
      },
      playerTwo: {
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarPath: true,
        },
      },
    },
  });

  if (!game) {
    return null;
  }

  const isPlayerOne = game.playerOneId === currentUserId;
  const currentPlayer = isPlayerOne ? game.playerOne : game.playerTwoId === currentUserId ? game.playerTwo : null;
  const opponent = isPlayerOne ? game.playerTwo : game.playerTwoId === currentUserId ? game.playerOne : null;
  const ownBoardData = parseBoard(isPlayerOne ? game.playerOneBoard : game.playerTwoBoard);
  const opponentBoardData = parseBoard(isPlayerOne ? game.playerTwoBoard : game.playerOneBoard);
  const ownShots = parseShots(isPlayerOne ? game.playerOneShots : game.playerTwoShots);
  const opponentShots = parseShots(isPlayerOne ? game.playerTwoShots : game.playerOneShots);
  const isTurn = game.currentTurnUserId === currentUserId && game.status === "playing";

  return {
    roomCode: game.roomCode,
    status: game.status as BattleshipStatus,
    currentUserId,
    currentPlayer: currentPlayer
      ? {
          id: currentPlayer.id,
          name: getName(currentPlayer),
          avatarPath: currentPlayer.avatarPath,
          ready: isPlayerOne ? game.playerOneReady : game.playerTwoReady,
          score: isPlayerOne ? game.playerOneScore : game.playerTwoScore,
          wins: isPlayerOne ? game.playerOneWins : game.playerTwoWins,
        }
      : null,
    opponent: opponent
      ? {
          id: opponent.id,
          name: getName(opponent),
          avatarPath: opponent.avatarPath,
          ready: isPlayerOne ? game.playerTwoReady : game.playerOneReady,
          score: isPlayerOne ? game.playerTwoScore : game.playerOneScore,
          wins: isPlayerOne ? game.playerTwoWins : game.playerOneWins,
        }
      : null,
    readyCount: Number(game.playerOneReady) + Number(game.playerTwoReady),
    boardSize: BATTLESHIP_BOARD_SIZE,
    shipLengths: [...BATTLESHIP_SHIP_LENGTHS],
    ownBoard: buildOwnBoard(ownBoardData, opponentShots),
    opponentBoard: buildOpponentBoard(opponentBoardData, ownShots, isTurn, game.status === "finished"),
    isCurrentUserTurn: isTurn,
    winnerId: game.winnerId,
    isPaused: game.isPaused,
    pauseRequestedByName: getPausedName(game.pauseRequestedById, {
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      playerOne: game.playerOne,
      playerTwo: game.playerTwo,
    }),
    exitRequestedByName: getPausedName(game.exitRequestedById, {
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      playerOne: game.playerOne,
      playerTwo: game.playerTwo,
    }),
    isCurrentUserExitRequester: game.exitRequestedById === currentUserId,
    canRespondToExit: Boolean(game.exitRequestedById && game.exitRequestedById !== currentUserId),
    shouldReturnToMenu: game.terminationReason === "agreed_exit",
  } satisfies BattleshipState;
}

export async function saveBattleshipPlacement(roomCode: string, currentUserId: string, board: number[][]) {
  const error = validatePlacement(board);

  if (error) {
    return { success: false as const, message: error };
  }

  const normalized = JSON.stringify(normalizeBoard(board));
  await ensureBattleshipGame(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się przygotować gry.",
    execute: async ({ game, staleResult }) =>
      prisma.$transaction(async (tx) => {
        if (game.isPaused) {
          return { success: false as const, message: "Gra jest obecnie wstrzymana." };
        }

        if (!isGameParticipant(game, currentUserId)) {
          return { success: false as const, message: "Nie należysz do tego pokoju gry." };
        }

        const isPlayerOne = game.playerOneId === currentUserId;
        const placementUpdate = await applyVersionedGameUpdate(
          tx.battleshipGame,
          game,
          {
            isPaused: false,
            status: { in: ["setup", "waiting"] },
          },
          isPlayerOne
            ? {
                playerOneBoard: normalized,
                playerOneReady: true,
              }
            : {
                playerTwoBoard: normalized,
                playerTwoReady: true,
              },
        );

        if (!placementUpdate) {
          return staleResult();
        }

        const updated = await tx.battleshipGame.findUnique({
          where: { id: game.id },
          select: {
            id: true,
            version: true,
            status: true,
            playerOneReady: true,
            playerTwoReady: true,
            playerOneId: true,
          },
        });

        if (!updated) {
          return staleResult("Nie znaleziono gry.");
        }

        if (updated.playerOneReady && updated.playerTwoReady && updated.status !== "playing") {
          await applyVersionedGameUpdate(
            tx.battleshipGame,
            updated,
            {
              status: { in: ["setup", "waiting"] },
            },
            {
              status: "playing",
              currentTurnUserId: updated.playerOneId,
            },
          );
        }

        return { success: true as const, message: "Statki ustawione. Czekamy na drugiego gracza." };
      }),
  });
}

export async function shootBattleship(roomCode: string, currentUserId: string, target: number) {
  if (!Number.isInteger(target) || target < 0 || target >= BATTLESHIP_CELL_COUNT) {
    return { success: false as const, message: "Wybrano nieprawidłowe pole." };
  }
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) =>
      prisma.$transaction(async (tx) => {
        if (game.status !== "playing") {
          return { success: false as const, message: "Gra nie jest jeszcze gotowa." };
        }

        if (game.isPaused) {
          return { success: false as const, message: "Gra jest obecnie wstrzymana." };
        }

        if (game.currentTurnUserId !== currentUserId) {
          return { success: false as const, message: "To nie jest Twój ruch." };
        }

        const isPlayerOne = game.playerOneId === currentUserId;
        const ownShots = parseShots(isPlayerOne ? game.playerOneShots : game.playerTwoShots);

        if (ownShots.includes(target)) {
          return { success: false as const, message: "W to pole już został oddany strzał." };
        }

        const opponentBoard = parseBoard(isPlayerOne ? game.playerTwoBoard : game.playerOneBoard);
        const opponentShipCells = opponentBoard.flat();
        const nextShots = [...ownShots, target].sort((a, b) => a - b);
        const isHit = opponentShipCells.includes(target);
        const allHit =
          opponentShipCells.length > 0 && opponentShipCells.every((cell) => nextShots.includes(cell));
        const opponentId = isPlayerOne ? game.playerTwoId : game.playerOneId;
        const shotUpdated = await applyVersionedGameUpdate(
          tx.battleshipGame,
          game,
          {
            status: "playing",
            isPaused: false,
            currentTurnUserId: currentUserId,
          },
          isPlayerOne
            ? {
                playerOneShots: JSON.stringify(nextShots),
                playerOneScore: isHit ? { increment: 1 } : undefined,
                playerOneWins: allHit ? { increment: 1 } : undefined,
                status: allHit ? "finished" : "playing",
                currentTurnUserId: allHit ? null : opponentId,
                winnerId: allHit ? currentUserId : null,
              }
            : {
                playerTwoShots: JSON.stringify(nextShots),
                playerTwoScore: isHit ? { increment: 1 } : undefined,
                playerTwoWins: allHit ? { increment: 1 } : undefined,
                status: allHit ? "finished" : "playing",
                currentTurnUserId: allHit ? null : opponentId,
                winnerId: allHit ? currentUserId : null,
              },
        );

        if (!shotUpdated) {
          return staleResult();
        }

        return {
          success: true as const,
          message: allHit
            ? isHit
              ? "Trafiony. Wygrywasz rundę i dostajesz punkt ogólny pokoju!"
              : "Wygrywasz rundę i dostajesz punkt ogólny pokoju!"
            : isHit
              ? "Trafiony!"
              : "Pudło.",
        };
      }),
  });
}

export async function restartBattleshipRound(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry do rewanżu.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const restarted = await applyVersionedGameUpdate(
        prisma.battleshipGame,
        game,
        {},
        {
          status: game.playerOneId && game.playerTwoId ? "setup" : "waiting",
          playerOneReady: false,
          playerTwoReady: false,
          playerOneBoard: null,
          playerTwoBoard: null,
          playerOneScore: 0,
          playerTwoScore: 0,
          playerOneShots: "[]",
          playerTwoShots: "[]",
          currentTurnUserId: null,
          winnerId: null,
          isPaused: false,
          pausedAt: null,
          pauseRequestedById: null,
          exitRequestedById: null,
          terminatedAt: null,
          terminationReason: null,
        },
      );

      if (!restarted) {
        return staleResult();
      }

      return { success: true as const, message: "Runda została zresetowana. Możecie zagrać rewanż." };
    },
  });
}

export async function pauseBattleshipGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (game.isPaused) {
        return { success: true as const, message: "Gra jest już wstrzymana." };
      }

      const paused = await applyVersionedGameUpdate(
        prisma.battleshipGame,
        game,
        { isPaused: false },
        {
          isPaused: true,
          pausedAt: new Date(),
          pauseRequestedById: currentUserId,
          exitRequestedById: null,
        },
      );

      if (!paused) {
        return staleResult();
      }

      return { success: true as const, message: "Gra została wstrzymana." };
    },
  });
}

export async function resumeBattleshipGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.isPaused) {
        return { success: true as const, message: "Gra już działa." };
      }

      const resumed = await applyVersionedGameUpdate(
        prisma.battleshipGame,
        game,
        { isPaused: true },
        {
          isPaused: false,
          pausedAt: null,
          pauseRequestedById: null,
          exitRequestedById: null,
        },
      );

      if (!resumed) {
        return staleResult();
      }

      return { success: true as const, message: "Gra została wznowiona." };
    },
  });
}

export async function requestBattleshipExit(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.isPaused) {
        return { success: false as const, message: "Najpierw wstrzymaj grę." };
      }

      const requested = await applyVersionedGameUpdate(
        prisma.battleshipGame,
        game,
        { isPaused: true },
        {
          exitRequestedById: currentUserId,
        },
      );

      if (!requested) {
        return staleResult();
      }

      return { success: true as const, message: "Wysłano prośbę o zakończenie gry." };
    },
  });
}

export async function respondBattleshipExit(
  roomCode: string,
  currentUserId: string,
  approve: boolean,
) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.battleshipGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.exitRequestedById || game.exitRequestedById === currentUserId) {
        return { success: false as const, message: "Nie ma prośby do potwierdzenia." };
      }

      if (!approve) {
        const cleared = await applyVersionedGameUpdate(
          prisma.battleshipGame,
          game,
          { exitRequestedById: game.exitRequestedById },
          {
            exitRequestedById: null,
          },
        );

        if (!cleared) {
          return staleResult();
        }

        return { success: true as const, message: "Gra pozostaje wstrzymana." };
      }

      const terminated = await applyVersionedGameUpdate(
        prisma.battleshipGame,
        game,
        { exitRequestedById: game.exitRequestedById },
        {
          status: game.playerOneId && game.playerTwoId ? "setup" : "waiting",
          playerOneReady: false,
          playerTwoReady: false,
          playerOneBoard: null,
          playerTwoBoard: null,
          playerOneScore: 0,
          playerTwoScore: 0,
          playerOneShots: "[]",
          playerTwoShots: "[]",
          currentTurnUserId: null,
          winnerId: null,
          isPaused: false,
          pausedAt: null,
          pauseRequestedById: null,
          exitRequestedById: null,
          terminatedAt: new Date(),
          terminationReason: "agreed_exit",
        },
      );

      if (!terminated) {
        return staleResult();
      }

      return { success: true as const, message: "Gra została zakończona za zgodą obu osób." };
    },
  });
}
