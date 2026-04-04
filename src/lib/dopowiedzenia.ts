import {
  applyVersionedGameUpdate,
  isGameParticipant,
  runGameCommand,
} from "@/lib/game-command";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TOTAL_ROUNDS = 5;
const MIN_WORDS = 6;
const REVEAL_MS = 1800;

type DopowiedzeniaStatus = "waiting" | "writing" | "reveal" | "finished";

type DopowiedzeniaPlayer = {
  id: string;
  name: string;
  avatarPath: string | null;
  submitted: boolean;
};

export type DopowiedzeniaState = {
  roomCode: string;
  status: DopowiedzeniaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  isInitialRound: boolean;
  playerOneName: string | null;
  playerTwoName: string | null;
  promptWords: string[];
  promptSourceName: string | null;
  currentPlayer: DopowiedzeniaPlayer | null;
  opponent: DopowiedzeniaPlayer | null;
  currentInput: string;
  otherSubmitted: boolean;
  revealEndsAt: number | null;
  playerOneStory: string;
  playerTwoStory: string;
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

function haveBothJoined(game: {
  playerOneId: string | null;
  playerTwoId: string | null;
  playerOneJoined: boolean;
  playerTwoJoined: boolean;
}) {
  return Boolean(game.playerOneId && game.playerTwoId && game.playerOneJoined && game.playerTwoJoined);
}

function getPlayerName(
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

function shouldWriteToSwappedStory(roundIndex: number) {
  return roundIndex > 0 && roundIndex % 2 === 1;
}

function getPromptStoryByRound(
  roundIndex: number,
  isPlayerOne: boolean,
  stories: { playerOneStory: string; playerTwoStory: string },
) {
  if (roundIndex <= 0) {
    return "";
  }

  const useSwappedStory = shouldWriteToSwappedStory(roundIndex);

  if (isPlayerOne) {
    return useSwappedStory ? stories.playerTwoStory : stories.playerOneStory;
  }

  return useSwappedStory ? stories.playerOneStory : stories.playerTwoStory;
}

function getPreservedJoinedFlag(
  nextPlayerId: string | null,
  existing: {
    playerOneId: string | null;
    playerTwoId: string | null;
    playerOneJoined: boolean;
    playerTwoJoined: boolean;
  },
) {
  if (!nextPlayerId) {
    return false;
  }

  if (existing.playerOneId === nextPlayerId) {
    return existing.playerOneJoined;
  }

  if (existing.playerTwoId === nextPlayerId) {
    return existing.playerTwoJoined;
  }

  return false;
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
  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;

  const existing = await prisma.dopowiedzeniaGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.dopowiedzeniaGame.create({
      data: {
        roomCode,
        status: "waiting",
        playerOneId,
        playerTwoId,
      },
    });
  }

  const playersChanged =
    existing.playerOneId !== playerOneId || existing.playerTwoId !== playerTwoId;

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.dopowiedzeniaGame.update({
      where: { id: existing.id },
      data: {
        status: "waiting",
        playerOneId,
        playerTwoId,
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
        terminatedAt: null,
        terminationReason: null,
      },
    });
  }

  if (!playersChanged) {
    return advanceRevealRound(roomCode);
  }

  const nextPlayerOneJoined = getPreservedJoinedFlag(playerOneId, existing);
  const nextPlayerTwoJoined = getPreservedJoinedFlag(playerTwoId, existing);

  return prisma.dopowiedzeniaGame.update({
    where: { id: existing.id },
    data: {
      status: "waiting",
      playerOneId,
      playerTwoId,
      playerOneJoined: nextPlayerOneJoined,
      playerTwoJoined: nextPlayerTwoJoined,
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
      terminatedAt: null,
      terminationReason: null,
    },
  });
}

export async function getDopowiedzeniaState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureDopowiedzeniaGame(roomCode, options);

  const game = await prisma.dopowiedzeniaGame.findUnique({
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
  const currentPlayer = isPlayerOne
    ? game.playerOne
    : game.playerTwoId === currentUserId
      ? game.playerTwo
      : null;
  const opponent = isPlayerOne
    ? game.playerTwo
    : game.playerTwoId === currentUserId
      ? game.playerOne
      : null;
  const currentInput = isPlayerOne ? game.playerOneSubmission : game.playerTwoSubmission;
  const otherInput = isPlayerOne ? game.playerTwoSubmission : game.playerOneSubmission;
  const promptStory = getPromptStoryByRound(game.roundIndex, isPlayerOne, {
    playerOneStory: game.playerOneStory,
    playerTwoStory: game.playerTwoStory,
  });
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
    playerOneName: game.playerOne ? getName(game.playerOne) : null,
    playerTwoName: game.playerTwo ? getName(game.playerTwo) : null,
    promptWords: game.roundIndex > 0 || game.status === "reveal" || game.status === "finished"
      ? getLastStoryWords(promptStory)
      : [],
    promptSourceName: opponent ? getName(opponent) : null,
    currentPlayer: currentPlayer
      ? {
          id: currentPlayer.id,
          name: getName(currentPlayer),
          avatarPath: currentPlayer.avatarPath,
          submitted: Boolean(currentInput),
        }
      : null,
    opponent: opponent
      ? {
          id: opponent.id,
          name: getName(opponent),
          avatarPath: opponent.avatarPath,
          submitted: Boolean(otherInput),
        }
      : null,
    currentInput: currentInput ?? "",
    otherSubmitted: Boolean(otherInput),
    revealEndsAt: game.roundResolvedAt ? game.roundResolvedAt.getTime() + REVEAL_MS : null,
    playerOneStory: game.playerOneStory,
    playerTwoStory: game.playerTwoStory,
    isPaused: game.isPaused,
    pausedAt: game.pausedAt ? game.pausedAt.getTime() : null,
    pauseRequestedByName: getPlayerName(game.pauseRequestedById, {
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      playerOne: game.playerOne,
      playerTwo: game.playerTwo,
    }),
    exitRequestedByName: getPlayerName(game.exitRequestedById, {
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      playerOne: game.playerOne,
      playerTwo: game.playerTwo,
    }),
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
      if (game.isPaused || game.terminatedAt || !isGameParticipant(game, currentUserId)) {
        return { success: true as const, message: "Stan gry został odświeżony." };
      }

      const isPlayerOne = game.playerOneId === currentUserId;
      const joinedUpdated = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {
          isPaused: false,
          terminatedAt: null,
          ...(isPlayerOne ? { playerOneJoined: false } : { playerTwoJoined: false }),
        },
        {
          ...(isPlayerOne ? { playerOneJoined: true } : { playerTwoJoined: true }),
        },
      );

      const joinedGame = await prisma.dopowiedzeniaGame.findUnique({
        where: { id: game.id },
      });

      if (!joinedGame) {
        return staleResult("Nie znaleziono gry.");
      }

      if (!joinedUpdated) {
        return { success: true as const, message: "Stan gry został odświeżony." };
      }

      if (joinedGame.status === "waiting" && haveBothJoined(joinedGame)) {
        await applyVersionedGameUpdate(
          prisma.dopowiedzeniaGame,
          joinedGame,
          {
            status: "waiting",
            playerOneJoined: true,
            playerTwoJoined: true,
          },
          {
            status: "writing",
          },
        );

        return { success: true as const, message: "Dopowiedzenia wystartowały." };
      }

      return { success: true as const, message: "Czekamy na drugą osobę." };
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
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      if (game.isPaused || game.terminatedAt) {
        return { success: false as const, message: "Gra jest obecnie niedostępna." };
      }

      if (game.status !== "writing") {
        return { success: false as const, message: "Poczekaj na swoją kolej pisania." };
      }

      const isPlayerOne = game.playerOneId === currentUserId;
      const currentSubmission = isPlayerOne ? game.playerOneSubmission : game.playerTwoSubmission;

      if (currentSubmission) {
        return { success: false as const, message: "Ta część historii została już wysłana." };
      }

      const saved = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {
          status: "writing",
          ...(isPlayerOne ? { playerOneSubmission: null } : { playerTwoSubmission: null }),
        },
        {
          ...(isPlayerOne ? { playerOneSubmission: normalizedText } : { playerTwoSubmission: normalizedText }),
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

      if (!updated.playerOneSubmission || !updated.playerTwoSubmission) {
        return {
          success: true as const,
          message: "Tekst zapisany. Czekamy na drugą osobę.",
        };
      }

      const isLastRound = updated.roundIndex >= TOTAL_ROUNDS - 1;
      let nextPlayerOneStory = updated.playerOneStory;
      let nextPlayerTwoStory = updated.playerTwoStory;

      if (updated.roundIndex === 0) {
        nextPlayerOneStory = normalizeStoryText(updated.playerOneSubmission);
        nextPlayerTwoStory = normalizeStoryText(updated.playerTwoSubmission);
      } else if (shouldWriteToSwappedStory(updated.roundIndex)) {
        nextPlayerOneStory = appendStorySegment(updated.playerOneStory, updated.playerTwoSubmission);
        nextPlayerTwoStory = appendStorySegment(updated.playerTwoStory, updated.playerOneSubmission);
      } else {
        nextPlayerOneStory = appendStorySegment(updated.playerOneStory, updated.playerOneSubmission);
        nextPlayerTwoStory = appendStorySegment(updated.playerTwoStory, updated.playerTwoSubmission);
      }

      const resolved = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        updated,
        {
          status: "writing",
        },
        {
          status: isLastRound ? "finished" : "reveal",
          playerOneStory: nextPlayerOneStory,
          playerTwoStory: nextPlayerTwoStory,
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
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const restarted = await applyVersionedGameUpdate(
        prisma.dopowiedzeniaGame,
        game,
        {},
        {
          status: game.playerOneId && game.playerTwoId ? "writing" : "waiting",
          playerOneJoined: Boolean(game.playerOneId),
          playerTwoJoined: Boolean(game.playerTwoId),
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
          terminatedAt: null,
          terminationReason: null,
        },
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
      if (!isGameParticipant(game, currentUserId)) {
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
      if (!isGameParticipant(game, currentUserId)) {
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
      if (!isGameParticipant(game, currentUserId)) {
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
      if (!isGameParticipant(game, currentUserId)) {
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
          status: "waiting",
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
