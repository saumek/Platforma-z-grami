import {
  applyVersionedGameUpdate,
  runGameCommand,
} from "@/lib/game-command";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TOTAL_ROUNDS = 5;
const MIN_WORDS = 6;
const REVEAL_MS = 1800;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

type DopowiedzeniaStatus = "waiting" | "writing" | "reveal" | "finished";

type RoomUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarPath: string | null;
  createdAt: Date;
};

type DopowiedzeniaPlayer = {
  id: string;
  name: string;
  avatarPath: string | null;
  submitted: boolean;
};

type DopowiedzeniaStory = {
  ownerId: string;
  ownerName: string;
  text: string;
};

export type DopowiedzeniaState = {
  roomCode: string;
  status: DopowiedzeniaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  isInitialRound: boolean;
  minPlayers: number;
  maxPlayers: number;
  joinedCount: number;
  promptWords: string[];
  promptSourceName: string | null;
  players: DopowiedzeniaPlayer[];
  currentPlayer: DopowiedzeniaPlayer | null;
  otherPlayers: DopowiedzeniaPlayer[];
  currentInput: string;
  otherSubmittedCount: number;
  revealEndsAt: number | null;
  stories: DopowiedzeniaStory[];
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

export function normalizeStoryText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function countStoryWords(value: string) {
  const matches = normalizeStoryText(value).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu);
  return matches?.length ?? 0;
}

export function getLastStoryWords(value: string, count = 3) {
  const words = normalizeStoryText(value).split(/\s+/).filter(Boolean);
  return words.slice(-count);
}

export function appendStorySegment(story: string, segment: string) {
  const normalizedStory = normalizeStoryText(story);
  const normalizedSegment = normalizeStoryText(segment);

  if (!normalizedStory) {
    return normalizedSegment;
  }

  if (!normalizedSegment) {
    return normalizedStory;
  }

  return `${normalizedStory} ${normalizedSegment}`.trim();
}

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

function parseStringMap(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, nextValue]) =>
        typeof nextValue === "string" ? [[key, nextValue]] : [],
      ),
    );
  } catch {
    return {} as Record<string, string>;
  }
}

function serializeStringMap(value: Record<string, string>) {
  return JSON.stringify(value);
}

function sanitizeParticipantIds(participantIds: string[], roomUsers: RoomUser[]) {
  const roomUserIdSet = new Set(roomUsers.map((user) => user.id));
  const uniqueIds = [] as string[];

  participantIds.forEach((userId) => {
    if (roomUserIdSet.has(userId) && !uniqueIds.includes(userId)) {
      uniqueIds.push(userId);
    }
  });

  return uniqueIds.slice(0, MAX_PLAYERS);
}

function getLegacyParticipantFields(participantIds: string[]) {
  return {
    playerOneId: participantIds[0] ?? null,
    playerTwoId: participantIds[1] ?? null,
  };
}

function getResetRoundState(
  participantIds: string[],
  options?: {
    status?: DopowiedzeniaStatus;
    clearParticipants?: boolean;
    terminatedAt?: Date | null;
    terminationReason?: string | null;
  },
) {
  const nextParticipantIds = options?.clearParticipants ? [] : participantIds;

  return {
    joinedPlayerIds: serializeStringArray(nextParticipantIds),
    playerOrder: serializeStringArray(nextParticipantIds),
    stories: serializeStringMap({}),
    submissions: serializeStringMap({}),
    ...getLegacyParticipantFields(nextParticipantIds),
    playerOneJoined: false,
    playerTwoJoined: false,
    roundIndex: 0,
    playerOneStory: "",
    playerTwoStory: "",
    playerOneSubmission: null,
    playerTwoSubmission: null,
    roundResolvedAt: null,
    isPaused: false,
    pausedAt: null,
    pauseRequestedById: null,
    exitRequestedById: null,
    terminatedAt: options?.terminatedAt ?? null,
    terminationReason: options?.terminationReason ?? null,
    status:
      options?.status ??
      (nextParticipantIds.length >= MIN_PLAYERS ? "writing" : "waiting"),
  };
}

function isParticipant(game: { joinedPlayerIds: string }, userId: string) {
  return parseStringArray(game.joinedPlayerIds).includes(userId);
}

function getPlayerName(requestedById: string | null, roomUsers: RoomUser[]) {
  if (!requestedById) {
    return null;
  }

  const player = roomUsers.find((user) => user.id === requestedById);
  return player ? getName(player) : "Drugi gracz";
}

function getTargetStoryOwnerId(
  participantIds: string[],
  currentUserId: string,
  roundIndex: number,
) {
  if (roundIndex <= 0 || participantIds.length === 0) {
    return null;
  }

  const playerIndex = participantIds.indexOf(currentUserId);

  if (playerIndex < 0) {
    return null;
  }

  return participantIds[(playerIndex + roundIndex) % participantIds.length] ?? null;
}

async function advanceRevealRound(roomCode: string) {
  const game = await prisma.dopowiedzeniaGame.findUnique({
    where: { roomCode },
  });

  if (!game || game.isPaused || game.terminatedAt) {
    return game;
  }

  if (game.status !== "reveal" || !game.roundResolvedAt) {
    return game;
  }

  if (game.roundResolvedAt.getTime() + REVEAL_MS > Date.now()) {
    return game;
  }

  await prisma.dopowiedzeniaGame.updateMany({
    where: {
      id: game.id,
      version: game.version,
      status: "reveal",
      isPaused: false,
    },
    data: {
      status: "writing",
      roundIndex: { increment: 1 },
      roundResolvedAt: null,
      version: { increment: 1 },
    },
  });

  return prisma.dopowiedzeniaGame.findUnique({
    where: { id: game.id },
  });
}

export async function ensureDopowiedzeniaGame(
  roomCode: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const roomUsers = await getRoomUsers(roomCode);
  const existing = await prisma.dopowiedzeniaGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.dopowiedzeniaGame.create({
      data: {
        roomCode,
        ...getResetRoundState([]),
      },
    });
  }

  const participantIds = sanitizeParticipantIds(parseStringArray(existing.joinedPlayerIds), roomUsers);
  const storedOrder = parseStringArray(existing.playerOrder);
  const shouldResetForParticipants =
    JSON.stringify(participantIds) !== JSON.stringify(parseStringArray(existing.joinedPlayerIds)) ||
    JSON.stringify(participantIds) !== JSON.stringify(storedOrder);

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.dopowiedzeniaGame.update({
      where: { id: existing.id },
      data: getResetRoundState([], { status: "waiting" }),
    });
  }

  if (shouldResetForParticipants) {
    return prisma.dopowiedzeniaGame.update({
      where: { id: existing.id },
      data: getResetRoundState(participantIds),
    });
  }

  if (existing.status === "waiting" && participantIds.length >= MIN_PLAYERS) {
    return prisma.dopowiedzeniaGame.update({
      where: { id: existing.id },
      data: {
        status: "writing",
      },
    });
  }

  return advanceRevealRound(roomCode);
}

export async function getDopowiedzeniaState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureDopowiedzeniaGame(roomCode, options);

  const [game, roomUsers] = await Promise.all([
    prisma.dopowiedzeniaGame.findUnique({
      where: { roomCode },
    }),
    getRoomUsers(roomCode),
  ]);

  if (!game) {
    return null;
  }

  const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
  const storiesMap = parseStringMap(game.stories);
  const submissionsMap = parseStringMap(game.submissions);
  const players = participantIds
    .map((participantId) => {
      const user = roomUsers.find((candidate) => candidate.id === participantId);

      if (!user) {
        return null;
      }

      return {
        id: participantId,
        name: getName(user),
        avatarPath: user.avatarPath,
        submitted: Boolean(submissionsMap[participantId]),
      } satisfies DopowiedzeniaPlayer;
    })
    .filter(Boolean) as DopowiedzeniaPlayer[];
  const currentPlayer = players.find((player) => player.id === currentUserId) ?? null;
  const otherPlayers = players.filter((player) => player.id !== currentUserId);
  const targetStoryOwnerId = getTargetStoryOwnerId(participantIds, currentUserId, game.roundIndex);
  const promptStory = targetStoryOwnerId ? storiesMap[targetStoryOwnerId] ?? "" : "";
  const promptSource = players.find((player) => player.id === targetStoryOwnerId) ?? null;
  const stories = participantIds
    .map((ownerId) => {
      const player = players.find((candidate) => candidate.id === ownerId);

      if (!player) {
        return null;
      }

      return {
        ownerId,
        ownerName: player.name,
        text: storiesMap[ownerId] ?? "",
      } satisfies DopowiedzeniaStory;
    })
    .filter(Boolean) as DopowiedzeniaStory[];
  const displayRound =
    game.status === "reveal" && game.roundIndex < TOTAL_ROUNDS - 1
      ? game.roundIndex + 2
      : Math.min(game.roundIndex + 1, TOTAL_ROUNDS);

  return {
    roomCode: game.roomCode,
    status: game.status as DopowiedzeniaStatus,
    currentUserId,
    roundIndex: displayRound,
    totalRounds: TOTAL_ROUNDS,
    isInitialRound: game.status === "writing" && game.roundIndex === 0,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    joinedCount: participantIds.length,
    promptWords:
      game.roundIndex > 0 || game.status === "reveal" || game.status === "finished"
        ? getLastStoryWords(promptStory)
        : [],
    promptSourceName: promptSource?.name ?? null,
    players,
    currentPlayer,
    otherPlayers,
    currentInput: submissionsMap[currentUserId] ?? "",
    otherSubmittedCount: otherPlayers.filter((player) => player.submitted).length,
    revealEndsAt: game.roundResolvedAt ? game.roundResolvedAt.getTime() + REVEAL_MS : null,
    stories,
    isPaused: game.isPaused,
    pausedAt: game.pausedAt ? game.pausedAt.getTime() : null,
    pauseRequestedByName: getPlayerName(game.pauseRequestedById, roomUsers),
    exitRequestedByName: getPlayerName(game.exitRequestedById, roomUsers),
    isCurrentUserExitRequester: game.exitRequestedById === currentUserId,
    canRespondToExit: Boolean(game.exitRequestedById && game.exitRequestedById !== currentUserId),
    shouldReturnToMenu: game.terminationReason === "agreed_exit",
  } satisfies DopowiedzeniaState;
}

export async function startDopowiedzeniaGame(roomCode: string, currentUserId: string) {
  await ensureDopowiedzeniaGame(roomCode, { resetTerminated: true });

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      const roomUsers = await getRoomUsers(roomCode);

      if (!roomUsers.some((user) => user.id === currentUserId)) {
        return { success: false as const, message: "Najpierw dołącz do pokoju." };
      }

      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);

      if (participantIds.includes(currentUserId)) {
        return {
          success: true as const,
          message:
            participantIds.length >= MIN_PLAYERS
              ? "Można zaczynać kolejną rundę historii."
              : "Czekamy na kolejne osoby.",
        };
      }

      if (participantIds.length >= MAX_PLAYERS) {
        return { success: false as const, message: "Do tej gry może wejść maksymalnie 4 osoby." };
      }

      const nextParticipantIds = [...participantIds, currentUserId];
      const updated = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {},
        getResetRoundState(nextParticipantIds),
      );

      if (!updated) {
        return staleResult();
      }

      return {
        success: true as const,
        message:
          nextParticipantIds.length >= MIN_PLAYERS
            ? "Można zaczynać historię."
            : "Do gry dołączyła pierwsza osoba.",
      };
    },
  });
}

export async function submitDopowiedzeniaText(
  roomCode: string,
  currentUserId: string,
  text: string,
) {
  const normalizedText = normalizeStoryText(text);

  if (countStoryWords(normalizedText) < MIN_WORDS) {
    return {
      success: false as const,
      message: "Ta część historii jest za krótka. Napisz trochę więcej.",
    };
  }

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (game.isPaused || game.terminatedAt) {
        return { success: false as const, message: "Gra jest obecnie niedostępna." };
      }

      if (game.status !== "writing") {
        return { success: false as const, message: "Poczekaj na swoją kolej pisania." };
      }

      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
      const submissionsMap = parseStringMap(game.submissions);

      if (submissionsMap[currentUserId]) {
        return { success: false as const, message: "Ta część historii została już wysłana." };
      }

      const nextSubmissions = {
        ...submissionsMap,
        [currentUserId]: normalizedText,
      };
      const saved = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {
          status: "writing",
        },
        {
          submissions: serializeStringMap(nextSubmissions),
          playerOneSubmission: participantIds[0] ? nextSubmissions[participantIds[0]] ?? null : null,
          playerTwoSubmission: participantIds[1] ? nextSubmissions[participantIds[1]] ?? null : null,
        },
      );

      if (!saved) {
        return staleResult();
      }

      const updated = await prisma.dopowiedzeniaGame.findUnique({
        where: { id: game.id },
      });

      if (!updated) {
        return staleResult("Nie znaleziono gry.");
      }

      const refreshedSubmissions = parseStringMap(updated.submissions);

      if (!participantIds.every((participantId) => Boolean(refreshedSubmissions[participantId]))) {
        return {
          success: true as const,
          message: "Tekst zapisany. Czekamy na drugą osobę.",
        };
      }

      const storiesMap = parseStringMap(updated.stories);
      const nextStories = { ...storiesMap };

      if (updated.roundIndex === 0) {
        participantIds.forEach((participantId) => {
          nextStories[participantId] = normalizeStoryText(refreshedSubmissions[participantId] ?? "");
        });
      } else {
        participantIds.forEach((participantId, playerIndex) => {
          const targetOwnerId = participantIds[(playerIndex + updated.roundIndex) % participantIds.length];

          if (!targetOwnerId) {
            return;
          }

          nextStories[targetOwnerId] = appendStorySegment(
            nextStories[targetOwnerId] ?? "",
            refreshedSubmissions[participantId] ?? "",
          );
        });
      }

      const isLastRound = updated.roundIndex >= TOTAL_ROUNDS - 1;
      const resolved = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        updated,
        {
          status: "writing",
        },
        {
          status: isLastRound ? "finished" : "reveal",
          stories: serializeStringMap(nextStories),
          submissions: serializeStringMap({}),
          playerOneStory: participantIds[0] ? nextStories[participantIds[0]] ?? "" : "",
          playerTwoStory: participantIds[1] ? nextStories[participantIds[1]] ?? "" : "",
          playerOneSubmission: null,
          playerTwoSubmission: null,
          roundResolvedAt: isLastRound ? null : new Date(),
        },
      );

      if (!resolved) {
        return staleResult();
      }

      return {
        success: true as const,
        message: isLastRound ? "Historie są gotowe." : "Nowa podpowiedź jest gotowa.",
      };
    },
  });
}

export async function restartDopowiedzeniaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry do restartu.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const roomUsers = await getRoomUsers(roomCode);
      const participantIds = sanitizeParticipantIds(parseStringArray(game.joinedPlayerIds), roomUsers);
      const restarted = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {},
        getResetRoundState(participantIds),
      );

      if (!restarted) {
        return staleResult();
      }

      return { success: true as const, message: "Nowa seria Dopowiedzeń jest gotowa." };
    },
  });
}

export async function pauseDopowiedzeniaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (game.isPaused) {
        return { success: true as const, message: "Gra jest już wstrzymana." };
      }

      const paused = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
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

export async function resumeDopowiedzeniaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.isPaused) {
        return { success: true as const, message: "Gra już działa." };
      }

      const pausedDuration = game.pausedAt ? Date.now() - game.pausedAt.getTime() : 0;
      const resumed = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        { isPaused: true },
        {
          isPaused: false,
          pausedAt: null,
          pauseRequestedById: null,
          exitRequestedById: null,
          roundResolvedAt:
            game.status === "reveal" && game.roundResolvedAt
              ? new Date(game.roundResolvedAt.getTime() + pausedDuration)
              : game.roundResolvedAt,
        },
      );

      if (!resumed) {
        return staleResult();
      }

      return { success: true as const, message: "Gra została wznowiona." };
    },
  });
}

export async function requestDopowiedzeniaExit(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.isPaused) {
        return { success: false as const, message: "Najpierw wstrzymaj grę." };
      }

      const requested = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
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

export async function respondDopowiedzeniaExit(
  roomCode: string,
  currentUserId: string,
  approve: boolean,
) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.dopowiedzeniaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (!isParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (!game.exitRequestedById || game.exitRequestedById === currentUserId) {
        return { success: false as const, message: "Nie ma prośby do potwierdzenia." };
      }

      if (!approve) {
        const cleared = await applyVersionedGameUpdate(
          prisma.dopowiedzeniaGame,
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
        prisma.dopowiedzeniaGame,
        game,
        { exitRequestedById: game.exitRequestedById },
        {
          ...getResetRoundState([], {
            status: "waiting",
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
