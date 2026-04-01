import qaQuestions from "@/data/qa-lightning.json";
import {
  applyVersionedGameUpdate,
  isGameParticipant,
  runGameCommand,
} from "@/lib/game-command";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TOTAL_ROUNDS = 10;
const QUESTION_TIMER_MS = 30_000;
const RESULT_REVEAL_MS = 3000;

type QuestionItem = {
  text: string;
  options: string[];
};

type CoupleQaStatus = "waiting" | "question" | "round_result" | "finished";

type CoupleQaPlayer = {
  id: string;
  name: string;
  avatarPath: string | null;
  roomPoints: number;
  answered: boolean;
};

export type CoupleQaState = {
  roomCode: string;
  status: CoupleQaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  compatibilityScore: number;
  compatibilityThreshold: number;
  compatibilityFill: number;
  question: {
    text: string;
    options: string[];
  } | null;
  currentPlayer: CoupleQaPlayer | null;
  opponent: CoupleQaPlayer | null;
  currentAnswer: number | null;
  opponentAnswered: boolean;
  questionEndsAt: number | null;
  lastMatch: boolean | null;
  resultRevealedUntil: number | null;
  isEligibleForBonus: boolean;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

function getQuestionPool() {
  return qaQuestions as QuestionItem[];
}

function shuffleIndexes(length: number) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex]!, indexes[index]!];
  }

  return indexes;
}

function parseQuestionOrder(value: string | null | undefined) {
  if (!value) {
    return [] as number[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is number => Number.isInteger(item));
  } catch {
    return [];
  }
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

function getFreshQuestionOrder() {
  return JSON.stringify(shuffleIndexes(getQuestionPool().length).slice(0, TOTAL_ROUNDS));
}

function haveBothJoined(game: {
  playerOneId: string | null;
  playerTwoId: string | null;
  playerOneJoined: boolean;
  playerTwoJoined: boolean;
}) {
  return Boolean(game.playerOneId && game.playerTwoId && game.playerOneJoined && game.playerTwoJoined);
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

async function advanceResolvedRound(roomCode: string) {
  const game = await prisma.coupleQaGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return game;
  }

  if (game.isPaused || game.terminatedAt) {
    return game;
  }

  if (
    game.status === "question" &&
    haveBothJoined(game) &&
    game.questionStartedAt &&
    game.questionStartedAt.getTime() + QUESTION_TIMER_MS <= Date.now()
  ) {
    const matched =
      game.playerOneAnswer !== null &&
      game.playerTwoAnswer !== null &&
      game.playerOneAnswer === game.playerTwoAnswer;

    await prisma.coupleQaGame.updateMany({
      where: {
        id: game.id,
        version: game.version,
        status: "question",
        isPaused: false,
      },
      data: {
        status: "round_result",
        compatibilityScore: matched ? { increment: 1 } : undefined,
        lastMatch: matched,
        roundResolvedAt: new Date(),
        questionStartedAt: null,
        version: { increment: 1 },
      },
    });

    return prisma.coupleQaGame.findUnique({
      where: { id: game.id },
    });
  }

  if (game.status !== "round_result" || !game.roundResolvedAt) {
    return game;
  }

  if (game.roundResolvedAt.getTime() + RESULT_REVEAL_MS > Date.now()) {
    return game;
  }

  const isLastRound = game.roundIndex >= TOTAL_ROUNDS - 1;

  if (isLastRound) {
    const shouldGrantReward = game.compatibilityScore >= 8 && !game.rewardGranted;

    await prisma.coupleQaGame.updateMany({
      where: {
        id: game.id,
        version: game.version,
        status: "round_result",
      },
      data: {
        status: "finished",
        playerOneRoomPoints: shouldGrantReward ? { increment: 1 } : undefined,
        playerTwoRoomPoints: shouldGrantReward ? { increment: 1 } : undefined,
        questionStartedAt: null,
        rewardGranted: shouldGrantReward ? true : game.rewardGranted,
        version: { increment: 1 },
      },
    });

    return prisma.coupleQaGame.findUnique({
      where: { id: game.id },
    });
  }

  await prisma.coupleQaGame.updateMany({
    where: {
      id: game.id,
      version: game.version,
      status: "round_result",
    },
    data: {
      status: "question",
      roundIndex: { increment: 1 },
      playerOneAnswer: null,
      playerTwoAnswer: null,
      questionStartedAt: new Date(),
      lastMatch: null,
      roundResolvedAt: null,
      version: { increment: 1 },
    },
  });

  return prisma.coupleQaGame.findUnique({
    where: { id: game.id },
  });
}

export async function ensureCoupleQaGame(
  roomCode: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;
  const nextStatus: CoupleQaStatus = "waiting";

  const existing = await prisma.coupleQaGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.coupleQaGame.create({
      data: {
        roomCode,
        status: nextStatus,
        playerOneId,
        playerTwoId,
        questionOrder: getFreshQuestionOrder(),
        playerOneJoined: false,
        playerTwoJoined: false,
        questionStartedAt: null,
      },
    });
  }

  const playersChanged =
    existing.playerOneId !== playerOneId || existing.playerTwoId !== playerTwoId;

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.coupleQaGame.update({
      where: { id: existing.id },
      data: {
        roomCode,
        status: "waiting",
        playerOneId,
        playerTwoId,
        compatibilityScore: 0,
        roundIndex: 0,
        questionOrder: getFreshQuestionOrder(),
        playerOneAnswer: null,
        playerTwoAnswer: null,
        playerOneJoined: false,
        playerTwoJoined: false,
        questionStartedAt: null,
        lastMatch: null,
        roundResolvedAt: null,
        rewardGranted: false,
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
    return advanceResolvedRound(roomCode);
  }

  return prisma.coupleQaGame.update({
    where: { id: existing.id },
    data: {
      roomCode,
      status: nextStatus,
      playerOneId,
      playerTwoId,
      compatibilityScore: 0,
      roundIndex: 0,
      questionOrder: getFreshQuestionOrder(),
      playerOneAnswer: null,
      playerTwoAnswer: null,
      playerOneJoined: false,
      playerTwoJoined: false,
      questionStartedAt: null,
      lastMatch: null,
      roundResolvedAt: null,
      rewardGranted: false,
      isPaused: false,
      pausedAt: null,
      pauseRequestedById: null,
      exitRequestedById: null,
      terminatedAt: null,
      terminationReason: null,
    },
  });
}

export async function getCoupleQaState(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureCoupleQaGame(roomCode, options);

  const game = await prisma.coupleQaGame.findUnique({
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

  const questionOrder = parseQuestionOrder(game.questionOrder);
  const question = questionOrder[game.roundIndex] !== undefined ? getQuestionPool()[questionOrder[game.roundIndex]!] : null;
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
  const currentAnswer = isPlayerOne ? game.playerOneAnswer : game.playerTwoAnswer;
  const opponentAnswer = isPlayerOne ? game.playerTwoAnswer : game.playerOneAnswer;
  const resultRevealedUntil = game.roundResolvedAt
    ? game.roundResolvedAt.getTime() + RESULT_REVEAL_MS
    : null;
  const questionEndsAt = game.questionStartedAt
    ? game.questionStartedAt.getTime() + QUESTION_TIMER_MS
    : null;

  return {
    roomCode: game.roomCode,
    status: game.status as CoupleQaStatus,
    currentUserId,
    roundIndex: game.roundIndex + 1,
    totalRounds: TOTAL_ROUNDS,
    compatibilityScore: game.compatibilityScore,
    compatibilityThreshold: 8,
    compatibilityFill: game.compatibilityScore / TOTAL_ROUNDS,
    question: question
      ? {
          text: question.text,
          options: question.options,
        }
      : null,
    currentPlayer: currentPlayer
      ? {
          id: currentPlayer.id,
          name: getName(currentPlayer),
          avatarPath: currentPlayer.avatarPath,
          roomPoints: isPlayerOne ? game.playerOneRoomPoints : game.playerTwoRoomPoints,
          answered: currentAnswer !== null,
        }
      : null,
    opponent: opponent
      ? {
          id: opponent.id,
          name: getName(opponent),
          avatarPath: opponent.avatarPath,
          roomPoints: isPlayerOne ? game.playerTwoRoomPoints : game.playerOneRoomPoints,
          answered: opponentAnswer !== null,
        }
      : null,
    currentAnswer,
    opponentAnswered: opponentAnswer !== null,
    questionEndsAt,
    lastMatch: game.lastMatch,
    resultRevealedUntil,
    isEligibleForBonus: game.compatibilityScore >= 8,
    isPaused: game.isPaused,
    pausedAt: game.pausedAt ? game.pausedAt.getTime() : null,
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
  } satisfies CoupleQaState;
}

export async function startCoupleQaGame(roomCode: string, currentUserId: string) {
  await ensureCoupleQaGame(roomCode, { resetTerminated: true });
  await runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (game.isPaused || game.terminatedAt || !isGameParticipant(game, currentUserId)) {
        return { success: true, message: "Stan gry został odświeżony." };
      }

      const isPlayerOne = game.playerOneId === currentUserId;
      const joinedUpdated = await applyVersionedGameUpdate(
        prisma.coupleQaGame,
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

      const joinedGame = await prisma.coupleQaGame.findUnique({
        where: { id: game.id },
      });

      if (!joinedGame) {
        return staleResult("Nie znaleziono gry.");
      }

      if (!joinedUpdated) {
        return { success: true, message: "Stan gry został odświeżony." };
      }

      if (joinedGame.status === "waiting" && haveBothJoined(joinedGame)) {
        await applyVersionedGameUpdate(
          prisma.coupleQaGame,
          joinedGame,
          {
            status: "waiting",
          },
          {
            status: "question",
            questionStartedAt: new Date(),
          },
        );
      }

      return { success: true, message: "Stan gry został odświeżony." };
    },
  });

  return prisma.coupleQaGame.findUnique({
    where: { roomCode },
  });
}

export async function submitCoupleQaAnswer(roomCode: string, currentUserId: string, answerIndex: number) {
  await advanceResolvedRound(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (game.status !== "question") {
        return { success: false as const, message: "Poczekaj na kolejną rundę." };
      }

      if (game.isPaused) {
        return { success: false as const, message: "Gra jest obecnie wstrzymana." };
      }

      const questionOrder = parseQuestionOrder(game.questionOrder);
      const question =
        questionOrder[game.roundIndex] !== undefined
          ? getQuestionPool()[questionOrder[game.roundIndex]!]
          : null;

      if (!question || answerIndex < 0 || answerIndex >= question.options.length) {
        return { success: false as const, message: "Wybrano nieprawidłową odpowiedź." };
      }

      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const isPlayerOne = game.playerOneId === currentUserId;
      const currentAnswer = isPlayerOne ? game.playerOneAnswer : game.playerTwoAnswer;

      if (currentAnswer !== null) {
        return { success: false as const, message: "Na to pytanie już odpowiedziałeś." };
      }

      const answerUpdated = await applyVersionedGameUpdate(
        prisma.coupleQaGame,
        game,
        {
          status: "question",
          isPaused: false,
          ...(isPlayerOne ? { playerOneAnswer: null } : { playerTwoAnswer: null }),
        },
        {
          ...(isPlayerOne ? { playerOneAnswer: answerIndex } : { playerTwoAnswer: answerIndex }),
        },
      );

      if (!answerUpdated) {
        return staleResult();
      }

      const updated = await prisma.coupleQaGame.findUnique({
        where: { id: game.id },
      });

      if (!updated) {
        return staleResult("Nie znaleziono gry.");
      }

      const playerOneAnswer = isPlayerOne ? answerIndex : updated.playerOneAnswer;
      const playerTwoAnswer = isPlayerOne ? updated.playerTwoAnswer : answerIndex;

      if (playerOneAnswer === null || playerTwoAnswer === null) {
        return { success: true as const, message: "Odpowiedź zapisana. Czekamy na drugą osobę." };
      }

      const matched = playerOneAnswer === playerTwoAnswer;
      const roundResolved = await applyVersionedGameUpdate(
        prisma.coupleQaGame,
        updated,
        {
          status: "question",
        },
        {
          status: "round_result",
          compatibilityScore: matched ? { increment: 1 } : undefined,
          lastMatch: matched,
          roundResolvedAt: new Date(),
        },
      );

      if (!roundResolved) {
        return staleResult();
      }

      return {
        success: true as const,
        message: matched ? "Macie zgodność!" : "Tym razem odpowiedzi się różniły.",
      };
    },
  });
}

export async function restartCoupleQaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry do restartu.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const restarted = await applyVersionedGameUpdate(
        prisma.coupleQaGame,
        game,
        {},
        {
          status: game.playerOneId && game.playerTwoId ? "question" : "waiting",
          compatibilityScore: 0,
          roundIndex: 0,
          questionOrder: getFreshQuestionOrder(),
          playerOneAnswer: null,
          playerTwoAnswer: null,
          playerOneJoined: Boolean(game.playerOneId),
          playerTwoJoined: Boolean(game.playerTwoId),
          questionStartedAt: game.playerOneId && game.playerTwoId ? new Date() : null,
          lastMatch: null,
          roundResolvedAt: null,
          rewardGranted: false,
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

      return { success: true as const, message: "Nowa seria pytań jest gotowa." };
    },
  });
}

export async function pauseCoupleQaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
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
        prisma.coupleQaGame,
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

export async function resumeCoupleQaGame(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
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
        prisma.coupleQaGame,
        game,
        { isPaused: true },
        {
          isPaused: false,
          pausedAt: null,
          pauseRequestedById: null,
          exitRequestedById: null,
          questionStartedAt:
            game.status === "question" && game.questionStartedAt
              ? new Date(game.questionStartedAt.getTime() + pausedDuration)
              : game.questionStartedAt,
          roundResolvedAt:
            game.status === "round_result" && game.roundResolvedAt
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

export async function requestCoupleQaExit(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
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
        prisma.coupleQaGame,
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

export async function respondCoupleQaExit(
  roomCode: string,
  currentUserId: string,
  approve: boolean,
) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.coupleQaGame.findUnique({
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
          prisma.coupleQaGame,
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
        prisma.coupleQaGame,
        game,
        { exitRequestedById: game.exitRequestedById },
        {
          status: "waiting",
          compatibilityScore: 0,
          roundIndex: 0,
          questionOrder: getFreshQuestionOrder(),
          playerOneAnswer: null,
          playerTwoAnswer: null,
          playerOneJoined: false,
          playerTwoJoined: false,
          questionStartedAt: null,
          lastMatch: null,
          roundResolvedAt: null,
          rewardGranted: false,
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

export async function getRoomScoreTotals(roomCode: string) {
  const [battleshipGame, coupleQaGame, scienceQuizGame, ludoGame] = await Promise.all([
    prisma.battleshipGame.findUnique({
      where: { roomCode },
      select: {
        playerOneWins: true,
        playerTwoWins: true,
      },
    }),
    prisma.coupleQaGame.findUnique({
      where: { roomCode },
      select: {
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
      },
    }),
    prisma.scienceQuizGame.findUnique({
      where: { roomCode },
      select: {
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
      },
    }),
    prisma.ludoGame.findUnique({
      where: { roomCode },
      select: {
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
      },
    }),
  ]);

  return {
    userOnePoints:
      (battleshipGame?.playerOneWins ?? 0) +
      (coupleQaGame?.playerOneRoomPoints ?? 0) +
      (scienceQuizGame?.playerOneRoomPoints ?? 0) +
      (ludoGame?.playerOneRoomPoints ?? 0),
    userTwoPoints:
      (battleshipGame?.playerTwoWins ?? 0) +
      (coupleQaGame?.playerTwoRoomPoints ?? 0) +
      (scienceQuizGame?.playerTwoRoomPoints ?? 0) +
      (ludoGame?.playerTwoRoomPoints ?? 0),
  };
}
