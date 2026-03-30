import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { LUDO_COLORS, LUDO_COLOR_LABELS, type LudoColor } from "@/lib/ludo-constants";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TRACK_LENGTH = 40;
const HOME_LENGTH = 4;
const FINISH_PROGRESS = TRACK_LENGTH + HOME_LENGTH - 1;
const START_PROGRESS = 0;
const TOKEN_COUNT = 4;

const COLOR_START_INDEX: Record<LudoColor, number> = {
  green: 0,
  yellow: 10,
  blue: 20,
  red: 30,
};

type LudoStatus = "waiting" | "color_selection" | "playing" | "finished";

type LudoPlayerState = {
  id: string;
  name: string;
  avatarPath: string | null;
  color: LudoColor | null;
  tokenProgresses: number[];
  finishedTokens: number;
};

export type LudoState = {
  roomCode: string;
  status: LudoStatus;
  currentUserId: string;
  currentPlayer: LudoPlayerState | null;
  opponent: LudoPlayerState | null;
  availableColors: {
    color: LudoColor;
    label: string;
    isTaken: boolean;
    isSelected: boolean;
  }[];
  currentTurnUserId: string | null;
  diceValue: number | null;
  movableTokenIndexes: number[];
  lastRollValue: number | null;
  lastRollByUserId: string | null;
  lastRollAt: number | null;
  winnerId: string | null;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

function getName(user: { email: string; displayName: string | null }) {
  return user.displayName ?? defaultDisplayName(user.email);
}

function parseTokens(value: string | null | undefined) {
  if (!value) {
    return Array.from({ length: TOKEN_COUNT }, () => -1);
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return Array.from({ length: TOKEN_COUNT }, () => -1);
    }

    return Array.from({ length: TOKEN_COUNT }, (_, index) => {
      const nextValue = parsed[index];
      return Number.isInteger(nextValue) ? Number(nextValue) : -1;
    });
  } catch {
    return Array.from({ length: TOKEN_COUNT }, () => -1);
  }
}

function serializeTokens(tokens: number[]) {
  return JSON.stringify(tokens);
}

function getFreshTokens() {
  return serializeTokens(Array.from({ length: TOKEN_COUNT }, () => -1));
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

function getTrackIndex(color: LudoColor, progress: number) {
  return (COLOR_START_INDEX[color] + progress) % TRACK_LENGTH;
}

function getTargetProgress(currentProgress: number, roll: number) {
  if (currentProgress === -1) {
    return roll === 6 ? START_PROGRESS : null;
  }

  const nextProgress = currentProgress + roll;

  if (nextProgress > FINISH_PROGRESS) {
    return null;
  }

  return nextProgress;
}

function getMovableTokenIndexes(
  ownTokens: number[],
  ownColor: LudoColor | null,
  opponentTokens: number[],
  opponentColor: LudoColor | null,
  roll: number | null,
) {
  if (!ownColor || !roll) {
    return [] as number[];
  }

  return ownTokens.flatMap((progress, index) => {
    const targetProgress = getTargetProgress(progress, roll);

    if (targetProgress === null) {
      return [];
    }

    const ownOccupied = ownTokens.some(
      (tokenProgress, tokenIndex) => tokenIndex !== index && tokenProgress === targetProgress,
    );

    if (ownOccupied && targetProgress !== FINISH_PROGRESS) {
      return [];
    }

    if (
      progress === -1 &&
      targetProgress === START_PROGRESS &&
      opponentColor &&
      opponentTokens.some(
        (tokenProgress) =>
          tokenProgress >= 0 &&
          tokenProgress <= TRACK_LENGTH - 1 &&
          getTrackIndex(opponentColor, tokenProgress) === getTrackIndex(ownColor, START_PROGRESS),
      )
    ) {
      return [index];
    }

    return [index];
  });
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

function getResetState(
  playerOneId: string | null,
  playerTwoId: string | null,
): {
  status: LudoStatus;
  playerOneId: string | null;
  playerTwoId: string | null;
  playerOneColor: null;
  playerTwoColor: null;
  playerOneTokens: string;
  playerTwoTokens: string;
  playerOneRoomPoints: 0;
  playerTwoRoomPoints: 0;
  rewardGranted: false;
  currentTurnUserId: null;
  diceValue: null;
  lastRollValue: null;
  lastRollById: null;
  lastRollAt: null;
  winnerId: null;
  isPaused: false;
  pausedAt: null;
  pauseRequestedById: null;
  exitRequestedById: null;
  terminatedAt: null;
  terminationReason: null;
} {
  return {
    status: playerOneId && playerTwoId ? "color_selection" : "waiting",
    playerOneId,
    playerTwoId,
    playerOneColor: null,
    playerTwoColor: null,
    playerOneTokens: getFreshTokens(),
    playerTwoTokens: getFreshTokens(),
    playerOneRoomPoints: 0,
    playerTwoRoomPoints: 0,
    rewardGranted: false,
    currentTurnUserId: null,
    diceValue: null,
    lastRollValue: null,
    lastRollById: null,
    lastRollAt: null,
    winnerId: null,
    isPaused: false,
    pausedAt: null,
    pauseRequestedById: null,
    exitRequestedById: null,
    terminatedAt: null,
    terminationReason: null,
  };
}

export async function ensureLudoGame(
  roomCode: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;

  const existing = await prisma.ludoGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.ludoGame.create({
      data: {
        roomCode,
        ...getResetState(playerOneId, playerTwoId),
      },
    });
  }

  const playersChanged =
    existing.playerOneId !== playerOneId || existing.playerTwoId !== playerTwoId;

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: getResetState(playerOneId, playerTwoId),
    });
  }

  if (playersChanged) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: getResetState(playerOneId, playerTwoId),
    });
  }

  if (
    existing.status === "waiting" &&
    playerOneId &&
    playerTwoId
  ) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: {
        status: "color_selection",
      },
    });
  }

  if (
    existing.status === "color_selection" &&
    existing.playerOneColor &&
    existing.playerTwoColor &&
    !existing.currentTurnUserId
  ) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: {
        status: "playing",
        currentTurnUserId: existing.playerOneId,
      },
    });
  }

  return existing;
}

export async function startLudoGame(roomCode: string, userId: string) {
  await ensureLudoGame(roomCode, { resetTerminated: true });

  const game = await prisma.ludoGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return null;
  }

  if (game.playerOneId !== userId && game.playerTwoId !== userId) {
    return game;
  }

  return ensureLudoGame(roomCode, { resetTerminated: true });
}

function getPlayerSide(game: {
  playerOneId: string | null;
  playerTwoId: string | null;
  playerOneColor: string | null;
  playerTwoColor: string | null;
  playerOneTokens: string;
  playerTwoTokens: string;
  playerOne?: { id: string; email: string; displayName: string | null; avatarPath: string | null } | null;
  playerTwo?: { id: string; email: string; displayName: string | null; avatarPath: string | null } | null;
}, currentUserId: string) {
  const isPlayerOne = game.playerOneId === currentUserId;

  const currentPlayer = isPlayerOne ? game.playerOne : game.playerTwoId === currentUserId ? game.playerTwo : null;
  const opponent = isPlayerOne ? game.playerTwo : game.playerTwoId === currentUserId ? game.playerOne : null;

  return {
    currentPlayer,
    currentColor: (isPlayerOne ? game.playerOneColor : game.playerTwoColor) as LudoColor | null,
    currentTokens: parseTokens(isPlayerOne ? game.playerOneTokens : game.playerTwoTokens),
    opponent,
    opponentColor: (isPlayerOne ? game.playerTwoColor : game.playerOneColor) as LudoColor | null,
    opponentTokens: parseTokens(isPlayerOne ? game.playerTwoTokens : game.playerOneTokens),
    isPlayerOne,
  };
}

export async function getLudoGameState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureLudoGame(roomCode, options);

  const game = await prisma.ludoGame.findUnique({
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

  const side = getPlayerSide(game, currentUserId);
  const movableTokenIndexes = getMovableTokenIndexes(
    side.currentTokens,
    side.currentColor,
    side.opponentTokens,
    side.opponentColor,
    game.currentTurnUserId === currentUserId ? game.diceValue : null,
  );

  return {
    roomCode: game.roomCode,
    status: game.status as LudoStatus,
    currentUserId,
    currentPlayer: side.currentPlayer
      ? {
          id: side.currentPlayer.id,
          name: getName(side.currentPlayer),
          avatarPath: side.currentPlayer.avatarPath,
          color: side.currentColor,
          tokenProgresses: side.currentTokens,
          finishedTokens: side.currentTokens.filter((progress) => progress === FINISH_PROGRESS).length,
        }
      : null,
    opponent: side.opponent
      ? {
          id: side.opponent.id,
          name: getName(side.opponent),
          avatarPath: side.opponent.avatarPath,
          color: side.opponentColor,
          tokenProgresses: side.opponentTokens,
          finishedTokens: side.opponentTokens.filter((progress) => progress === FINISH_PROGRESS).length,
        }
      : null,
    availableColors: LUDO_COLORS.map((color) => ({
      color,
      label: LUDO_COLOR_LABELS[color],
      isTaken: game.playerOneColor === color || game.playerTwoColor === color,
      isSelected:
        (game.playerOneId === currentUserId && game.playerOneColor === color) ||
        (game.playerTwoId === currentUserId && game.playerTwoColor === color),
    })),
    currentTurnUserId: game.currentTurnUserId,
    diceValue: game.diceValue,
    movableTokenIndexes,
    lastRollValue: game.lastRollValue,
    lastRollByUserId: game.lastRollById,
    lastRollAt: game.lastRollAt?.getTime() ?? null,
    winnerId: game.winnerId,
    isPaused: game.isPaused,
    pausedAt: game.pausedAt?.getTime() ?? null,
    pauseRequestedByName: getPausedName(game.pauseRequestedById, game),
    exitRequestedByName: getPausedName(game.exitRequestedById, game),
    isCurrentUserExitRequester: game.exitRequestedById === currentUserId,
    canRespondToExit: Boolean(game.exitRequestedById && game.exitRequestedById !== currentUserId),
    shouldReturnToMenu: Boolean(game.terminatedAt),
  } satisfies LudoState;
}

export async function chooseLudoColor(roomCode: string, userId: string, color: string) {
  const game = await ensureLudoGame(roomCode, { resetTerminated: true });

  if (!game) {
    return { success: false, message: "Nie udało się przygotować gry." };
  }

  if (game.status === "finished") {
    return { success: false, message: "Ta partia jest już zakończona." };
  }

  if (!LUDO_COLORS.includes(color as LudoColor)) {
    return { success: false, message: "Wybierz poprawny kolor." };
  }

  if (game.playerOneId !== userId && game.playerTwoId !== userId) {
    return { success: false, message: "Nie jesteś graczem tej partii." };
  }

  const nextColor = color as LudoColor;
  const isPlayerOne = game.playerOneId === userId;
  const opponentColor = isPlayerOne ? game.playerTwoColor : game.playerOneColor;

  if (opponentColor === nextColor) {
    return { success: false, message: "Ten kolor został już zajęty." };
  }

  const updated = await prisma.ludoGame.update({
    where: { id: game.id },
    data: isPlayerOne ? { playerOneColor: nextColor } : { playerTwoColor: nextColor },
  });

  if (updated.playerOneColor && updated.playerTwoColor) {
    await prisma.ludoGame.update({
      where: { id: updated.id },
      data: {
        status: "playing",
        currentTurnUserId: updated.playerOneId,
      },
    });
  }

  return { success: true, message: "Kolor został wybrany." };
}

export async function rollLudoDice(roomCode: string, userId: string) {
  const game = await ensureLudoGame(roomCode);

  if (!game) {
    return { success: false, message: "Nie udało się znaleźć gry." };
  }

  if (game.isPaused || game.terminatedAt) {
    return { success: false, message: "Gra jest obecnie niedostępna." };
  }

  if (game.status !== "playing") {
    return { success: false, message: "Gra nie jest jeszcze gotowa do ruchu." };
  }

  if (game.currentTurnUserId !== userId) {
    return { success: false, message: "Teraz ruch należy do drugiej osoby." };
  }

  if (game.diceValue !== null) {
    return { success: false, message: "Najpierw wybierz pionek do przesunięcia." };
  }

  const isPlayerOne = game.playerOneId === userId;
  const ownColor = (isPlayerOne ? game.playerOneColor : game.playerTwoColor) as LudoColor | null;
  const opponentColor = (isPlayerOne ? game.playerTwoColor : game.playerOneColor) as LudoColor | null;
  const ownTokens = parseTokens(isPlayerOne ? game.playerOneTokens : game.playerTwoTokens);
  const opponentTokens = parseTokens(isPlayerOne ? game.playerTwoTokens : game.playerOneTokens);

  if (!ownColor || !opponentColor) {
    return { success: false, message: "Obie osoby muszą najpierw wybrać kolory." };
  }

  const value = Math.floor(Math.random() * 6) + 1;
  const movableTokenIndexes = getMovableTokenIndexes(
    ownTokens,
    ownColor,
    opponentTokens,
    opponentColor,
    value,
  );

  if (movableTokenIndexes.length === 0) {
    await prisma.ludoGame.update({
      where: { id: game.id },
      data: {
        diceValue: null,
        lastRollValue: value,
        lastRollById: userId,
        lastRollAt: new Date(),
        currentTurnUserId: isPlayerOne ? game.playerTwoId : game.playerOneId,
      },
    });

    return { success: true, message: `Wypadło ${value}. Nie masz możliwego ruchu.` };
  }

  await prisma.ludoGame.update({
    where: { id: game.id },
    data: {
      diceValue: value,
      lastRollValue: value,
      lastRollById: userId,
      lastRollAt: new Date(),
    },
  });

  return { success: true, message: `Wypadło ${value}. Wybierz pionek.` };
}

export async function moveLudoToken(roomCode: string, userId: string, tokenIndex: number) {
  const game = await ensureLudoGame(roomCode);

  if (!game) {
    return { success: false, message: "Nie udało się znaleźć gry." };
  }

  if (game.isPaused || game.terminatedAt) {
    return { success: false, message: "Gra jest obecnie niedostępna." };
  }

  if (game.status !== "playing" || game.currentTurnUserId !== userId || game.diceValue === null) {
    return { success: false, message: "Nie możesz teraz poruszyć pionkiem." };
  }

  const isPlayerOne = game.playerOneId === userId;
  const ownColor = (isPlayerOne ? game.playerOneColor : game.playerTwoColor) as LudoColor | null;
  const opponentColor = (isPlayerOne ? game.playerTwoColor : game.playerOneColor) as LudoColor | null;
  const ownTokens = parseTokens(isPlayerOne ? game.playerOneTokens : game.playerTwoTokens);
  const opponentTokens = parseTokens(isPlayerOne ? game.playerTwoTokens : game.playerOneTokens);

  if (!ownColor || !opponentColor) {
    return { success: false, message: "Brakuje wyboru kolorów." };
  }

  const movableTokenIndexes = getMovableTokenIndexes(
    ownTokens,
    ownColor,
    opponentTokens,
    opponentColor,
    game.diceValue,
  );

  if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= TOKEN_COUNT || !movableTokenIndexes.includes(tokenIndex)) {
    return { success: false, message: "Ten pionek nie może się teraz ruszyć." };
  }

  const nextProgress = getTargetProgress(ownTokens[tokenIndex] ?? -1, game.diceValue);

  if (nextProgress === null) {
    return { success: false, message: "Nieprawidłowy ruch." };
  }

  ownTokens[tokenIndex] = nextProgress;

  if (nextProgress >= 0 && nextProgress <= TRACK_LENGTH - 1) {
    const landingTrackIndex = getTrackIndex(ownColor, nextProgress);

    opponentTokens.forEach((progress, index) => {
      if (progress >= 0 && progress <= TRACK_LENGTH - 1 && getTrackIndex(opponentColor, progress) === landingTrackIndex) {
        opponentTokens[index] = -1;
      }
    });
  }

  const hasWon = ownTokens.every((progress) => progress === FINISH_PROGRESS);
  const shouldGrantRoomPoint = hasWon && !game.rewardGranted;

  await prisma.ludoGame.update({
    where: { id: game.id },
    data: isPlayerOne
      ? {
          playerOneTokens: serializeTokens(ownTokens),
          playerTwoTokens: serializeTokens(opponentTokens),
          playerOneRoomPoints: shouldGrantRoomPoint ? { increment: 1 } : undefined,
          rewardGranted: shouldGrantRoomPoint ? true : undefined,
          diceValue: null,
          currentTurnUserId: hasWon
            ? null
            : game.diceValue === 6
              ? game.playerOneId
              : game.playerTwoId,
          status: hasWon ? "finished" : "playing",
          winnerId: hasWon ? userId : null,
        }
      : {
          playerOneTokens: serializeTokens(opponentTokens),
          playerTwoTokens: serializeTokens(ownTokens),
          playerTwoRoomPoints: shouldGrantRoomPoint ? { increment: 1 } : undefined,
          rewardGranted: shouldGrantRoomPoint ? true : undefined,
          diceValue: null,
          currentTurnUserId: hasWon
            ? null
            : game.diceValue === 6
              ? game.playerTwoId
              : game.playerOneId,
          status: hasWon ? "finished" : "playing",
          winnerId: hasWon ? userId : null,
        },
  });

  return { success: true, message: hasWon ? "Partia zakończona zwycięstwem." : "Ruch wykonany." };
}

export async function restartLudo(
  roomCode: string,
  userId: string,
  options?: {
    resetToWaiting?: boolean;
  },
) {
  const game = await ensureLudoGame(roomCode, { resetTerminated: true });

  if (!game) {
    return { success: false, message: "Nie udało się znaleźć gry." };
  }

  if (game.playerOneId !== userId && game.playerTwoId !== userId) {
    return { success: false, message: "Nie jesteś graczem tej partii." };
  }

  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;
  const shouldWait = options?.resetToWaiting ?? false;

  await prisma.ludoGame.update({
    where: { id: game.id },
    data: {
      playerOneId,
      playerTwoId,
      playerOneColor: null,
      playerTwoColor: null,
      playerOneTokens: getFreshTokens(),
      playerTwoTokens: getFreshTokens(),
      rewardGranted: false,
      currentTurnUserId: null,
      diceValue: null,
      lastRollValue: null,
      lastRollById: null,
      lastRollAt: null,
      winnerId: null,
      isPaused: false,
      pausedAt: null,
      pauseRequestedById: null,
      exitRequestedById: null,
      terminatedAt: null,
      terminationReason: null,
      status: shouldWait ? (playerOneId && playerTwoId ? "color_selection" : "waiting") : (playerOneId && playerTwoId ? "color_selection" : "waiting"),
    },
  });

  return { success: true, message: "Przygotowano nową partię Chińczyka." };
}

export async function setLudoPauseState(
  roomCode: string,
  userId: string,
  action: "pause" | "resume",
) {
  const game = await ensureLudoGame(roomCode);

  if (!game) {
    return { success: false, message: "Nie udało się znaleźć gry." };
  }

  if (game.playerOneId !== userId && game.playerTwoId !== userId) {
    return { success: false, message: "Nie jesteś graczem tej partii." };
  }

  if (action === "pause") {
    await prisma.ludoGame.update({
      where: { id: game.id },
      data: {
        isPaused: true,
        pausedAt: new Date(),
        pauseRequestedById: userId,
      },
    });

    return { success: true, message: "Gra została wstrzymana." };
  }

  await prisma.ludoGame.update({
    where: { id: game.id },
    data: {
      isPaused: false,
      pausedAt: null,
      pauseRequestedById: null,
      exitRequestedById: null,
    },
  });

  return { success: true, message: "Gra została wznowiona." };
}

export async function handleLudoExit(
  roomCode: string,
  userId: string,
  action: "request" | "respond",
  approve?: boolean,
) {
  const game = await ensureLudoGame(roomCode);

  if (!game) {
    return { success: false, message: "Nie udało się znaleźć gry." };
  }

  if (game.playerOneId !== userId && game.playerTwoId !== userId) {
    return { success: false, message: "Nie jesteś graczem tej partii." };
  }

  if (action === "request") {
    await prisma.ludoGame.update({
      where: { id: game.id },
      data: {
        isPaused: true,
        pausedAt: new Date(),
        pauseRequestedById: userId,
        exitRequestedById: userId,
      },
    });

    return { success: true, message: "Wysłano prośbę o zakończenie gry." };
  }

  if (!game.exitRequestedById || game.exitRequestedById === userId) {
    return { success: false, message: "Nie ma prośby o zakończenie do zaakceptowania." };
  }

  if (!approve) {
    await prisma.ludoGame.update({
      where: { id: game.id },
      data: {
        exitRequestedById: null,
      },
    });

    return { success: true, message: "Gra będzie kontynuowana." };
  }

  await prisma.ludoGame.update({
    where: { id: game.id },
    data: {
      terminatedAt: new Date(),
      terminationReason: "exit_confirmed",
      isPaused: true,
      pausedAt: new Date(),
    },
  });

  return { success: true, message: "Gra została zakończona za zgodą obu osób." };
}
