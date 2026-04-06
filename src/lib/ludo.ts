import {
  applyVersionedGameUpdate,
  runGameCommand,
} from "@/lib/game-command";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { LUDO_COLORS, LUDO_COLOR_LABELS, type LudoColor } from "@/lib/ludo-constants";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TRACK_LENGTH = 40;
const HOME_LENGTH = 4;
const FINISH_PROGRESS = TRACK_LENGTH + HOME_LENGTH - 1;
const START_PROGRESS = 0;
const TOKEN_COUNT = 4;
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

const COLOR_START_INDEX: Record<LudoColor, number> = {
  green: 0,
  yellow: 10,
  blue: 20,
  red: 30,
};

type LudoStatus = "waiting" | "color_selection" | "playing" | "finished";

type RoomUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarPath: string | null;
  createdAt: Date;
};

type LudoPlayerState = {
  id: string;
  name: string;
  avatarPath: string | null;
  color: LudoColor | null;
  tokenProgresses: number[];
  finishedTokens: number;
  roomPoints: number;
};

export type LudoState = {
  roomCode: string;
  status: LudoStatus;
  currentUserId: string;
  minPlayers: number;
  maxPlayers: number;
  joinedCount: number;
  players: LudoPlayerState[];
  currentPlayer: LudoPlayerState | null;
  otherPlayers: LudoPlayerState[];
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

async function getRoomUsers(roomCode: string) {
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
    take: MAX_PLAYERS,
  });
}

function parseStringArray(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function serializeStringArray(value: string[]) {
  return JSON.stringify(value);
}

function parseColorMap(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, LudoColor>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, LudoColor>;
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([userId, color]) =>
        typeof color === "string" && LUDO_COLORS.includes(color as LudoColor)
          ? [[userId, color as LudoColor]]
          : [],
      ),
    );
  } catch {
    return {} as Record<string, LudoColor>;
  }
}

function serializeColorMap(value: Record<string, LudoColor>) {
  return JSON.stringify(value);
}

function parseTokenMap(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, number[]>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, number[]>;
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([userId, tokenProgresses]) => {
        const tokens = Array.isArray(tokenProgresses)
          ? Array.from({ length: TOKEN_COUNT }, (_, index) => {
              const nextValue = tokenProgresses[index];
              return Number.isInteger(nextValue) ? Number(nextValue) : -1;
            })
          : Array.from({ length: TOKEN_COUNT }, () => -1);

        return [userId, tokens];
      }),
    );
  } catch {
    return {} as Record<string, number[]>;
  }
}

function serializeTokenMap(value: Record<string, number[]>) {
  return JSON.stringify(value);
}

function parsePointsMap(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, number>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, number>;
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([userId, points]) =>
        Number.isFinite(points) ? [[userId, Number(points)]] : [],
      ),
    );
  } catch {
    return {} as Record<string, number>;
  }
}

function serializePointsMap(value: Record<string, number>) {
  return JSON.stringify(value);
}

function isFinishedToken(progress: number) {
  return progress >= TRACK_LENGTH && progress <= FINISH_PROGRESS;
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

function getFreshTokens() {
  return Array.from({ length: TOKEN_COUNT }, () => -1);
}

function sanitizeParticipantIds(
  participantIds: string[],
  roomUsers: RoomUser[],
) {
  const roomUserIdSet = new Set(roomUsers.map((user) => user.id));
  const uniqueIds = [] as string[];

  participantIds.forEach((userId) => {
    if (roomUserIdSet.has(userId) && !uniqueIds.includes(userId)) {
      uniqueIds.push(userId);
    }
  });

  return uniqueIds.slice(0, MAX_PLAYERS);
}

function getLegacyParticipantFields(
  participantIds: string[],
  roomPointsByUser: Record<string, number>,
) {
  const playerOneId = participantIds[0] ?? null;
  const playerTwoId = participantIds[1] ?? null;

  return {
    playerOneId,
    playerTwoId,
    playerOneRoomPoints: playerOneId ? roomPointsByUser[playerOneId] ?? 0 : 0,
    playerTwoRoomPoints: playerTwoId ? roomPointsByUser[playerTwoId] ?? 0 : 0,
  };
}

function getResetRoundState(
  participantIds: string[],
  roomPointsByUser: Record<string, number>,
  options?: {
    status?: LudoStatus;
    clearParticipants?: boolean;
    terminatedAt?: Date | null;
    terminationReason?: string | null;
  },
) {
  const nextParticipantIds = options?.clearParticipants ? [] : participantIds;
  const nextRoomPointsByUser = Object.fromEntries(
    Object.entries(roomPointsByUser).filter(([userId]) => nextParticipantIds.includes(userId) || !options?.clearParticipants),
  );
  const tokenProgresses = Object.fromEntries(
    nextParticipantIds.map((userId) => [userId, getFreshTokens()]),
  ) as Record<string, number[]>;
  const status =
    options?.status ??
    (nextParticipantIds.length >= MIN_PLAYERS ? "color_selection" : "waiting");

  return {
    joinedPlayerIds: serializeStringArray(nextParticipantIds),
    playerOrder: serializeStringArray(nextParticipantIds),
    selectedColors: serializeColorMap({}),
    tokenProgresses: serializeTokenMap(tokenProgresses),
    roomPointsByUser: serializePointsMap(nextRoomPointsByUser),
    ...getLegacyParticipantFields(nextParticipantIds, nextRoomPointsByUser),
    playerOneColor: null,
    playerTwoColor: null,
    playerOneTokens: JSON.stringify(getFreshTokens()),
    playerTwoTokens: JSON.stringify(getFreshTokens()),
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
    terminatedAt: options?.terminatedAt ?? null,
    terminationReason: options?.terminationReason ?? null,
    status,
  };
}

function isLudoParticipant(game: { joinedPlayerIds: string }, userId: string) {
  return parseStringArray(game.joinedPlayerIds).includes(userId);
}

function getNextParticipantId(participantIds: string[], currentUserId: string) {
  if (participantIds.length <= 1) {
    return null;
  }

  const currentIndex = participantIds.indexOf(currentUserId);

  if (currentIndex < 0) {
    return participantIds[0] ?? null;
  }

  return participantIds[(currentIndex + 1) % participantIds.length] ?? null;
}

function getMovableTokenIndexes(
  ownTokens: number[],
  ownColor: LudoColor | null,
  otherPlayers: Array<{ color: LudoColor | null; tokens: number[] }>,
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

    if (ownOccupied) {
      return [];
    }

    if (
      progress === -1 &&
      targetProgress === START_PROGRESS &&
      otherPlayers.some(
        (player) =>
          player.color &&
          player.tokens.some(
            (tokenProgress) =>
              tokenProgress >= 0 &&
              tokenProgress <= TRACK_LENGTH - 1 &&
              getTrackIndex(player.color!, tokenProgress) === getTrackIndex(ownColor, START_PROGRESS),
          ),
      )
    ) {
      return [index];
    }

    return [index];
  });
}

function getPausedName(
  requestedById: string | null,
  roomUsers: RoomUser[],
) {
  if (!requestedById) {
    return null;
  }

  const player = roomUsers.find((user) => user.id === requestedById);
  return player ? getName(player) : "Drugi gracz";
}

export async function ensureLudoGame(
  roomCode: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const roomUsers = await getRoomUsers(roomCode);
  const existing = await prisma.ludoGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.ludoGame.create({
      data: {
        roomCode,
        ...getResetRoundState([], {}),
      },
    });
  }

  const roomPointsByUser = parsePointsMap(existing.roomPointsByUser);
  const participantIds = sanitizeParticipantIds(
    parseStringArray(existing.joinedPlayerIds),
    roomUsers,
  );
  const storedOrder = parseStringArray(existing.playerOrder);
  const shouldResetForParticipants =
    JSON.stringify(participantIds) !== JSON.stringify(parseStringArray(existing.joinedPlayerIds)) ||
    JSON.stringify(participantIds) !== JSON.stringify(storedOrder);

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: getResetRoundState([], roomPointsByUser),
    });
  }

  if (shouldResetForParticipants) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: getResetRoundState(participantIds, roomPointsByUser),
    });
  }

  if (existing.status === "waiting" && participantIds.length >= MIN_PLAYERS) {
    return prisma.ludoGame.update({
      where: { id: existing.id },
      data: {
        status: "color_selection",
      },
    });
  }

  return existing;
}

export async function startLudoGame(roomCode: string, userId: string) {
  await ensureLudoGame(roomCode, { resetTerminated: true });

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się przygotować gry.",
    execute: async ({ game, staleResult }) => {
      const roomUsers = await getRoomUsers(roomCode);

      if (!roomUsers.some((user) => user.id === userId)) {
        return { success: false as const, message: "Najpierw dołącz do pokoju." };
      }

      const roomPointsByUser = parsePointsMap(game.roomPointsByUser);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);

      if (participantIds.includes(userId)) {
        return {
          success: true as const,
          message:
            participantIds.length >= MIN_PLAYERS
              ? "Można wybierać kolory."
              : "Czekamy na kolejne osoby.",
        };
      }

      if (participantIds.length >= MAX_PLAYERS) {
        return { success: false as const, message: "Do tej gry może wejść maksymalnie 4 osoby." };
      }

      const nextParticipantIds = [...participantIds, userId];
      const updated = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        {},
        getResetRoundState(nextParticipantIds, roomPointsByUser),
      );

      if (!updated) {
        return staleResult();
      }

      return {
        success: true as const,
        message:
          nextParticipantIds.length >= MIN_PLAYERS
            ? "Można wybierać kolory."
            : "Do gry dołączono pierwszą osobę.",
      };
    },
  });
}

export async function getLudoGameState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureLudoGame(roomCode, options);

  const [game, roomUsers] = await Promise.all([
    prisma.ludoGame.findUnique({
      where: { roomCode },
    }),
    getRoomUsers(roomCode),
  ]);

  if (!game) {
    return null;
  }

  const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
  const selectedColors = parseColorMap(game.selectedColors);
  const tokenMap = parseTokenMap(game.tokenProgresses);
  const roomPointsByUser = parsePointsMap(game.roomPointsByUser);

  const players = participantIds
    .map((participantId) => {
      const user = roomUsers.find((candidate) => candidate.id === participantId);

      if (!user) {
        return null;
      }

      const tokenProgresses = tokenMap[participantId] ?? getFreshTokens();
      return {
        id: participantId,
        name: getName(user),
        avatarPath: user.avatarPath,
        color: selectedColors[participantId] ?? null,
        tokenProgresses,
        finishedTokens: tokenProgresses.filter((progress) => isFinishedToken(progress)).length,
        roomPoints: roomPointsByUser[participantId] ?? 0,
      } satisfies LudoPlayerState;
    })
    .filter(Boolean) as LudoPlayerState[];

  const currentPlayer = players.find((player) => player.id === currentUserId) ?? null;
  const otherPlayers = players.filter((player) => player.id !== currentUserId);
  const movableTokenIndexes = currentPlayer
    ? getMovableTokenIndexes(
        currentPlayer.tokenProgresses,
        currentPlayer.color,
        otherPlayers.map((player) => ({
          color: player.color,
          tokens: player.tokenProgresses,
        })),
        game.currentTurnUserId === currentUserId ? game.diceValue : null,
      )
    : [];

  return {
    roomCode: game.roomCode,
    status: game.status as LudoStatus,
    currentUserId,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    joinedCount: participantIds.length,
    players,
    currentPlayer,
    otherPlayers,
    availableColors: LUDO_COLORS.map((color) => ({
      color,
      label: LUDO_COLOR_LABELS[color],
      isTaken: Object.values(selectedColors).includes(color),
      isSelected: selectedColors[currentUserId] === color,
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
    pauseRequestedByName: getPausedName(game.pauseRequestedById, roomUsers),
    exitRequestedByName: getPausedName(game.exitRequestedById, roomUsers),
    isCurrentUserExitRequester: game.exitRequestedById === currentUserId,
    canRespondToExit: Boolean(game.exitRequestedById && game.exitRequestedById !== currentUserId),
    shouldReturnToMenu: Boolean(game.terminatedAt),
  } satisfies LudoState;
}

export async function chooseLudoColor(roomCode: string, userId: string, color: string) {
  await ensureLudoGame(roomCode, { resetTerminated: true });

  if (!LUDO_COLORS.includes(color as LudoColor)) {
    return { success: false as const, message: "Wybierz poprawny kolor." };
  }

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);

      if (!participantIds.includes(userId)) {
        return { success: false as const, message: "Najpierw wejdź do tej gry." };
      }

      if (participantIds.length < MIN_PLAYERS) {
        return { success: false as const, message: "Do startu potrzeba przynajmniej 2 osób." };
      }

      const selectedColors = parseColorMap(game.selectedColors);
      const nextColor = color as LudoColor;

      if (
        Object.entries(selectedColors).some(
          ([selectedUserId, selectedColor]) => selectedUserId !== userId && selectedColor === nextColor,
        )
      ) {
        return { success: false as const, message: "Ten kolor został już zajęty." };
      }

      const nextSelectedColors = {
        ...selectedColors,
        [userId]: nextColor,
      } satisfies Record<string, LudoColor>;
      const roomPointsByUser = parsePointsMap(game.roomPointsByUser);
      const nextTokenMap = parseTokenMap(game.tokenProgresses);
      participantIds.forEach((participantId) => {
        nextTokenMap[participantId] = nextTokenMap[participantId] ?? getFreshTokens();
      });

      const allPlayersReady = participantIds.every((participantId) => Boolean(nextSelectedColors[participantId]));
      const updated = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        { status: { not: "finished" } },
        {
          ...getLegacyParticipantFields(participantIds, roomPointsByUser),
          selectedColors: serializeColorMap(nextSelectedColors),
          tokenProgresses: serializeTokenMap(nextTokenMap),
          playerOneColor: participantIds[0] ? nextSelectedColors[participantIds[0]] ?? null : null,
          playerTwoColor: participantIds[1] ? nextSelectedColors[participantIds[1]] ?? null : null,
          status: allPlayersReady ? "playing" : "color_selection",
          currentTurnUserId: allPlayersReady ? participantIds[0] ?? null : null,
        },
      );

      if (!updated) {
        return staleResult();
      }

      return { success: true as const, message: "Kolor został wybrany." };
    },
  });
}

export async function rollLudoDice(roomCode: string, userId: string) {
  await ensureLudoGame(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      if (game.isPaused || game.terminatedAt) {
        return { success: false as const, message: "Gra jest obecnie niedostępna." };
      }

      if (game.status !== "playing") {
        return { success: false as const, message: "Gra nie jest jeszcze gotowa do ruchu." };
      }

      if (game.currentTurnUserId !== userId) {
        return { success: false as const, message: "Teraz ruch należy do innej osoby." };
      }

      if (game.diceValue !== null) {
        return { success: false as const, message: "Najpierw wybierz pionek do przesunięcia." };
      }

      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
      const selectedColors = parseColorMap(game.selectedColors);
      const tokenMap = parseTokenMap(game.tokenProgresses);
      const ownColor = selectedColors[userId] ?? null;
      const ownTokens = tokenMap[userId] ?? getFreshTokens();
      const otherPlayers = participantIds
        .filter((participantId) => participantId !== userId)
        .map((participantId) => ({
          color: selectedColors[participantId] ?? null,
          tokens: tokenMap[participantId] ?? getFreshTokens(),
        }));

      if (!ownColor || participantIds.length < MIN_PLAYERS) {
        return { success: false as const, message: "Gra nie jest jeszcze gotowa." };
      }

      const value = Math.floor(Math.random() * 6) + 1;
      const movableTokenIndexes = getMovableTokenIndexes(ownTokens, ownColor, otherPlayers, value);
      const updateSucceeded = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        {
          status: "playing",
          isPaused: false,
          terminatedAt: null,
          currentTurnUserId: userId,
          diceValue: null,
        },
        movableTokenIndexes.length === 0
          ? {
              diceValue: null,
              lastRollValue: value,
              lastRollById: userId,
              lastRollAt: new Date(),
              currentTurnUserId: getNextParticipantId(participantIds, userId),
            }
          : {
              diceValue: value,
              lastRollValue: value,
              lastRollById: userId,
              lastRollAt: new Date(),
            },
      );

      if (!updateSucceeded) {
        return staleResult();
      }

      return {
        success: true as const,
        message:
          movableTokenIndexes.length === 0
            ? `Wypadło ${value}. Nie masz możliwego ruchu.`
            : `Wypadło ${value}. Wybierz pionek.`,
      };
    },
  });
}

export async function moveLudoToken(roomCode: string, userId: string, tokenIndex: number) {
  await ensureLudoGame(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      if (game.isPaused || game.terminatedAt) {
        return { success: false as const, message: "Gra jest obecnie niedostępna." };
      }

      if (game.status !== "playing" || game.currentTurnUserId !== userId || game.diceValue === null) {
        return { success: false as const, message: "Nie możesz teraz poruszyć pionkiem." };
      }

      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
      const selectedColors = parseColorMap(game.selectedColors);
      const tokenMap = parseTokenMap(game.tokenProgresses);
      const roomPointsByUser = parsePointsMap(game.roomPointsByUser);
      const ownColor = selectedColors[userId] ?? null;
      const ownTokens = [...(tokenMap[userId] ?? getFreshTokens())];
      const otherPlayerIds = participantIds.filter((participantId) => participantId !== userId);
      const otherPlayers = otherPlayerIds.map((participantId) => ({
        id: participantId,
        color: selectedColors[participantId] ?? null,
        tokens: [...(tokenMap[participantId] ?? getFreshTokens())],
      }));

      if (!ownColor) {
        return { success: false as const, message: "Najpierw wybierz kolor." };
      }

      const movableTokenIndexes = getMovableTokenIndexes(
        ownTokens,
        ownColor,
        otherPlayers.map((player) => ({ color: player.color, tokens: player.tokens })),
        game.diceValue,
      );

      if (
        !Number.isInteger(tokenIndex) ||
        tokenIndex < 0 ||
        tokenIndex >= TOKEN_COUNT ||
        !movableTokenIndexes.includes(tokenIndex)
      ) {
        return { success: false as const, message: "Ten pionek nie może się teraz ruszyć." };
      }

      const nextProgress = getTargetProgress(ownTokens[tokenIndex] ?? -1, game.diceValue);

      if (nextProgress === null) {
        return { success: false as const, message: "Nieprawidłowy ruch." };
      }

      ownTokens[tokenIndex] = nextProgress;

      if (nextProgress >= 0 && nextProgress <= TRACK_LENGTH - 1) {
        const landingTrackIndex = getTrackIndex(ownColor, nextProgress);

        otherPlayers.forEach((player) => {
          if (!player.color) {
            return;
          }

          player.tokens = player.tokens.map((progress) =>
            progress >= 0 &&
            progress <= TRACK_LENGTH - 1 &&
            getTrackIndex(player.color!, progress) === landingTrackIndex
              ? -1
              : progress,
          );
        });
      }

      tokenMap[userId] = ownTokens;
      otherPlayers.forEach((player) => {
        tokenMap[player.id] = player.tokens;
      });

      const hasWon = ownTokens.every((progress) => isFinishedToken(progress));
      const nextRoomPointsByUser = { ...roomPointsByUser };

      if (hasWon) {
        nextRoomPointsByUser[userId] = (nextRoomPointsByUser[userId] ?? 0) + 1;
      }

      const updated = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        {
          status: "playing",
          isPaused: false,
          terminatedAt: null,
          currentTurnUserId: userId,
          diceValue: game.diceValue,
        },
        {
          tokenProgresses: serializeTokenMap(tokenMap),
          roomPointsByUser: serializePointsMap(nextRoomPointsByUser),
          ...getLegacyParticipantFields(participantIds, nextRoomPointsByUser),
          diceValue: null,
          currentTurnUserId: hasWon
            ? null
            : game.diceValue === 6
              ? userId
              : getNextParticipantId(participantIds, userId),
          status: hasWon ? "finished" : "playing",
          winnerId: hasWon ? userId : null,
          rewardGranted: hasWon ? true : game.rewardGranted,
          playerOneTokens: JSON.stringify(tokenMap[participantIds[0] ?? ""] ?? getFreshTokens()),
          playerTwoTokens: JSON.stringify(tokenMap[participantIds[1] ?? ""] ?? getFreshTokens()),
        },
      );

      if (!updated) {
        return staleResult();
      }

      return {
        success: true as const,
        message: hasWon ? "Partia zakończona zwycięstwem." : "Ruch wykonany.",
      };
    },
  });
}

export async function restartLudo(
  roomCode: string,
  userId: string,
  options?: {
    resetToWaiting?: boolean;
  },
) {
  await ensureLudoGame(roomCode, { resetTerminated: true });

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);

      if (!participantIds.includes(userId)) {
        return { success: false as const, message: "Nie jesteś uczestnikiem tej partii." };
      }

      const roomPointsByUser = parsePointsMap(game.roomPointsByUser);
      const nextParticipantIds = options?.resetToWaiting ? [] : participantIds;
      const restarted = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        {},
        getResetRoundState(nextParticipantIds, roomPointsByUser),
      );

      if (!restarted) {
        return staleResult();
      }

      return { success: true as const, message: "Przygotowano nową partię Chińczyka." };
    },
  });
}

export async function setLudoPauseState(
  roomCode: string,
  userId: string,
  action: "pause" | "resume",
) {
  await ensureLudoGame(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      if (!isLudoParticipant(game, userId)) {
        return { success: false as const, message: "Nie jesteś uczestnikiem tej partii." };
      }

      if (action === "pause") {
        if (game.isPaused) {
          return { success: true as const, message: "Gra jest już wstrzymana." };
        }

        const paused = await applyVersionedGameUpdate(
          prisma.ludoGame,
          game,
          { isPaused: false },
          {
            isPaused: true,
            pausedAt: new Date(),
            pauseRequestedById: userId,
            exitRequestedById: null,
          },
        );

        if (!paused) {
          return staleResult();
        }

        return { success: true as const, message: "Gra została wstrzymana." };
      }

      if (!game.isPaused) {
        return { success: true as const, message: "Gra już działa." };
      }

      const resumed = await applyVersionedGameUpdate(
        prisma.ludoGame,
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

export async function handleLudoExit(
  roomCode: string,
  userId: string,
  action: "request" | "respond",
  approve?: boolean,
) {
  await ensureLudoGame(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.ludoGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie udało się znaleźć gry.",
    execute: async ({ game, staleResult }) => {
      if (!isLudoParticipant(game, userId)) {
        return { success: false as const, message: "Nie jesteś uczestnikiem tej partii." };
      }

      if (action === "request") {
        const requested = await applyVersionedGameUpdate(
          prisma.ludoGame,
          game,
          {},
          {
            isPaused: true,
            pausedAt: new Date(),
            pauseRequestedById: userId,
            exitRequestedById: userId,
          },
        );

        if (!requested) {
          return staleResult();
        }

        return { success: true as const, message: "Wysłano prośbę o zakończenie gry." };
      }

      if (!game.exitRequestedById || game.exitRequestedById === userId) {
        return { success: false as const, message: "Nie ma prośby o zakończenie do zaakceptowania." };
      }

      if (!approve) {
        const cleared = await applyVersionedGameUpdate(
          prisma.ludoGame,
          game,
          { exitRequestedById: game.exitRequestedById },
          {
            exitRequestedById: null,
          },
        );

        if (!cleared) {
          return staleResult();
        }

        return { success: true as const, message: "Gra będzie kontynuowana." };
      }

      const roomPointsByUser = parsePointsMap(game.roomPointsByUser);
      const terminated = await applyVersionedGameUpdate(
        prisma.ludoGame,
        game,
        { exitRequestedById: game.exitRequestedById },
        {
          ...getResetRoundState([], roomPointsByUser, {
            terminatedAt: new Date(),
            terminationReason: "agreed_exit",
          }),
        },
      );

      if (!terminated) {
        return staleResult();
      }

      return { success: true as const, message: "Gra została zakończona za zgodą wszystkich stron." };
    },
  });
}
