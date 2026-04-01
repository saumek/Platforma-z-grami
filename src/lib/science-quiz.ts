import scienceGeografia from "@/data/science-quiz/geografia.json";
import scienceMatma from "@/data/science-quiz/matma.json";
import scienceNauka from "@/data/science-quiz/nauka.json";
import scienceWiedzaOgolna from "@/data/science-quiz/wiedza-ogolna.json";
import {
  applyVersionedGameUpdate,
  isGameParticipant,
  runGameCommand,
} from "@/lib/game-command";
import {
  type ScienceQuizCategory,
  SCIENCE_QUIZ_CATEGORY_LABELS,
  normalizeScienceQuizCategory,
} from "@/lib/science-quiz-categories";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TOTAL_ROUNDS = 10;
const QUESTION_TIMER_MS = 30_000;
const RESULT_REVEAL_MS = 3_000;

type ScienceQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
};

type ScienceQuizStatus = "waiting" | "question" | "round_result" | "finished";

type ScienceQuizPlayer = {
  id: string;
  name: string;
  avatarPath: string | null;
  score: number;
  answered: boolean;
};

export type ScienceQuizState = {
  roomCode: string;
  category: ScienceQuizCategory;
  categoryLabel: string;
  status: ScienceQuizStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  question: {
    text: string;
    options: string[];
  } | null;
  currentPlayer: ScienceQuizPlayer | null;
  opponent: ScienceQuizPlayer | null;
  currentAnswer: number | null;
  opponentAnswered: boolean;
  questionEndsAt: number | null;
  resultRevealedUntil: number | null;
  revealedCorrectIndex: number | null;
  currentPlayerCorrect: boolean | null;
  opponentCorrect: boolean | null;
  winnerId: string | null;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

function getQuestionPool(category: ScienceQuizCategory) {
  if (category === "geografia") {
    return scienceGeografia as ScienceQuestion[];
  }

  if (category === "nauka") {
    return scienceNauka as ScienceQuestion[];
  }

  if (category === "wiedza-ogolna") {
    return scienceWiedzaOgolna as ScienceQuestion[];
  }

  return scienceMatma as ScienceQuestion[];
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

function getFreshQuestionOrder(category: ScienceQuizCategory) {
  return JSON.stringify(shuffleIndexes(getQuestionPool(category).length).slice(0, TOTAL_ROUNDS));
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

function getWinnerId(game: {
  playerOneId: string | null;
  playerTwoId: string | null;
  playerOneScore: number;
  playerTwoScore: number;
}) {
  if (game.playerOneScore === game.playerTwoScore) {
    return null;
  }

  return game.playerOneScore > game.playerTwoScore ? game.playerOneId : game.playerTwoId;
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

async function advanceScienceQuizLifecycle(roomCode: string) {
  const game = await prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return game;
  }

  if (game.isPaused || game.terminatedAt) {
    return game;
  }

  const category = normalizeScienceQuizCategory(game.category);
  const questionOrder = parseQuestionOrder(game.questionOrder);
  const questionIndex = questionOrder[game.roundIndex];
  const question =
    questionIndex !== undefined ? getQuestionPool(category)[questionIndex] : null;

  if (
    game.status === "question" &&
    haveBothJoined(game) &&
    game.questionStartedAt &&
    game.questionStartedAt.getTime() + QUESTION_TIMER_MS <= Date.now()
  ) {
    const playerOneCorrect =
      question !== null &&
      game.playerOneAnswer !== null &&
      game.playerOneAnswer === question.correctIndex;
    const playerTwoCorrect =
      question !== null &&
      game.playerTwoAnswer !== null &&
      game.playerTwoAnswer === question.correctIndex;

    await prisma.scienceQuizGame.updateMany({
      where: {
        id: game.id,
        version: game.version,
        status: "question",
        isPaused: false,
      },
      data: {
        status: "round_result",
        playerOneScore: playerOneCorrect ? { increment: 1 } : undefined,
        playerTwoScore: playerTwoCorrect ? { increment: 1 } : undefined,
        questionStartedAt: null,
        roundResolvedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return prisma.scienceQuizGame.findUnique({
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
    const winnerId = getWinnerId(game);
    const shouldGrantPlayerOnePoint =
      winnerId !== null && winnerId === game.playerOneId && !game.rewardGranted;
    const shouldGrantPlayerTwoPoint =
      winnerId !== null && winnerId === game.playerTwoId && !game.rewardGranted;

    await prisma.scienceQuizGame.updateMany({
      where: {
        id: game.id,
        version: game.version,
        status: "round_result",
      },
      data: {
        status: "finished",
        playerOneRoomPoints: shouldGrantPlayerOnePoint ? { increment: 1 } : undefined,
        playerTwoRoomPoints: shouldGrantPlayerTwoPoint ? { increment: 1 } : undefined,
        questionStartedAt: null,
        rewardGranted: winnerId !== null ? true : game.rewardGranted,
        version: { increment: 1 },
      },
    });

    return prisma.scienceQuizGame.findUnique({
      where: { id: game.id },
    });
  }

  await prisma.scienceQuizGame.updateMany({
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
      roundResolvedAt: null,
      version: { increment: 1 },
    },
  });

  return prisma.scienceQuizGame.findUnique({
    where: { id: game.id },
  });
}

export async function ensureScienceQuizGame(
  roomCode: string,
  requestedCategory: string | null | undefined,
  options?: {
    resetTerminated?: boolean;
  },
) {
  const category = normalizeScienceQuizCategory(requestedCategory);
  const roomPlayers = await getRoomPlayers(roomCode);
  const playerOneId = roomPlayers[0]?.id ?? null;
  const playerTwoId = roomPlayers[1]?.id ?? null;

  const existing = await prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });

  if (!existing) {
    return prisma.scienceQuizGame.create({
      data: {
        roomCode,
        category,
        status: "waiting",
        playerOneId,
        playerTwoId,
        questionOrder: getFreshQuestionOrder(category),
        playerOneJoined: false,
        playerTwoJoined: false,
      },
    });
  }

  const playersChanged =
    existing.playerOneId !== playerOneId || existing.playerTwoId !== playerTwoId;

  if (existing.terminatedAt && options?.resetTerminated) {
    return prisma.scienceQuizGame.update({
      where: { id: existing.id },
      data: {
        roomCode,
        category,
        status: "waiting",
        playerOneId,
        playerTwoId,
        playerOneJoined: false,
        playerTwoJoined: false,
        playerOneScore: 0,
        playerTwoScore: 0,
        roundIndex: 0,
        questionOrder: getFreshQuestionOrder(category),
        playerOneAnswer: null,
        playerTwoAnswer: null,
        questionStartedAt: null,
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

  if (playersChanged) {
    return prisma.scienceQuizGame.update({
      where: { id: existing.id },
      data: {
        roomCode,
        category,
        status: "waiting",
        playerOneId,
        playerTwoId,
        playerOneJoined: false,
        playerTwoJoined: false,
        playerOneScore: 0,
        playerTwoScore: 0,
        roundIndex: 0,
        questionOrder: getFreshQuestionOrder(category),
        playerOneAnswer: null,
        playerTwoAnswer: null,
        questionStartedAt: null,
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

  if (
    existing.status === "waiting" &&
    !existing.playerOneJoined &&
    !existing.playerTwoJoined &&
    existing.category !== category
  ) {
    return prisma.scienceQuizGame.update({
      where: { id: existing.id },
      data: {
        category,
        questionOrder: getFreshQuestionOrder(category),
        roundIndex: 0,
        playerOneAnswer: null,
        playerTwoAnswer: null,
        questionStartedAt: null,
        roundResolvedAt: null,
        rewardGranted: false,
      },
    });
  }

  return advanceScienceQuizLifecycle(roomCode);
}

export async function startScienceQuizGame(
  roomCode: string,
  currentUserId: string,
  requestedCategory: string | null | undefined,
) {
  await ensureScienceQuizGame(roomCode, requestedCategory, { resetTerminated: true });
  await runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry.",
    execute: async ({ game, staleResult }) => {
      if (game.isPaused || game.terminatedAt || !isGameParticipant(game, currentUserId)) {
        return { success: true, message: "Stan gry został odświeżony." };
      }

      const isPlayerOne = game.playerOneId === currentUserId;
      const joinedUpdated = await applyVersionedGameUpdate(
        prisma.scienceQuizGame,
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

      const joinedGame = await prisma.scienceQuizGame.findUnique({
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
          prisma.scienceQuizGame,
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

  return prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });
}

export async function getScienceQuizState(
  roomCode: string,
  currentUserId: string,
  requestedCategory: string | null | undefined,
  options?: {
    resetTerminated?: boolean;
  },
) {
  await ensureScienceQuizGame(roomCode, requestedCategory, options);

  const game = await prisma.scienceQuizGame.findUnique({
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

  const category = normalizeScienceQuizCategory(game.category);
  const questionOrder = parseQuestionOrder(game.questionOrder);
  const questionIndex = questionOrder[game.roundIndex];
  const question =
    questionIndex !== undefined ? getQuestionPool(category)[questionIndex] : null;
  const isPlayerOne = game.playerOneId === currentUserId;
  const currentPlayer =
    isPlayerOne ? game.playerOne : game.playerTwoId === currentUserId ? game.playerTwo : null;
  const opponent =
    isPlayerOne ? game.playerTwo : game.playerTwoId === currentUserId ? game.playerOne : null;
  const currentAnswer = isPlayerOne ? game.playerOneAnswer : game.playerTwoAnswer;
  const opponentAnswer = isPlayerOne ? game.playerTwoAnswer : game.playerOneAnswer;
  const questionEndsAt = game.questionStartedAt
    ? game.questionStartedAt.getTime() + QUESTION_TIMER_MS
    : null;
  const resultRevealedUntil = game.roundResolvedAt
    ? game.roundResolvedAt.getTime() + RESULT_REVEAL_MS
    : null;
  const revealedCorrectIndex = game.status === "question" ? null : question?.correctIndex ?? null;
  const currentPlayerCorrect =
    revealedCorrectIndex !== null && currentAnswer !== null
      ? currentAnswer === revealedCorrectIndex
      : null;
  const opponentCorrect =
    revealedCorrectIndex !== null && opponentAnswer !== null
      ? opponentAnswer === revealedCorrectIndex
      : null;

  return {
    roomCode: game.roomCode,
    category,
    categoryLabel: SCIENCE_QUIZ_CATEGORY_LABELS[category],
    status: game.status as ScienceQuizStatus,
    currentUserId,
    roundIndex: game.roundIndex + 1,
    totalRounds: TOTAL_ROUNDS,
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
          score: isPlayerOne ? game.playerOneScore : game.playerTwoScore,
          answered: currentAnswer !== null,
        }
      : null,
    opponent: opponent
      ? {
          id: opponent.id,
          name: getName(opponent),
          avatarPath: opponent.avatarPath,
          score: isPlayerOne ? game.playerTwoScore : game.playerOneScore,
          answered: opponentAnswer !== null,
        }
      : null,
    currentAnswer,
    opponentAnswered: opponentAnswer !== null,
    questionEndsAt,
    resultRevealedUntil,
    revealedCorrectIndex,
    currentPlayerCorrect,
    opponentCorrect,
    winnerId: game.status === "finished" ? getWinnerId(game) : null,
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
  } satisfies ScienceQuizState;
}

export async function submitScienceQuizAnswer(
  roomCode: string,
  currentUserId: string,
  answerIndex: number,
) {
  await advanceScienceQuizLifecycle(roomCode);

  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
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

      const category = normalizeScienceQuizCategory(game.category);
      const questionOrder = parseQuestionOrder(game.questionOrder);
      const questionIndex = questionOrder[game.roundIndex];
      const question =
        questionIndex !== undefined ? getQuestionPool(category)[questionIndex] : null;

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
        prisma.scienceQuizGame,
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

      const updated = await prisma.scienceQuizGame.findUnique({
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

      const playerOneCorrect = playerOneAnswer === question.correctIndex;
      const playerTwoCorrect = playerTwoAnswer === question.correctIndex;
      const roundResolved = await applyVersionedGameUpdate(
        prisma.scienceQuizGame,
        updated,
        {
          status: "question",
        },
        {
          status: "round_result",
          playerOneScore: playerOneCorrect ? { increment: 1 } : undefined,
          playerTwoScore: playerTwoCorrect ? { increment: 1 } : undefined,
          questionStartedAt: null,
          roundResolvedAt: new Date(),
        },
      );

      if (!roundResolved) {
        return staleResult();
      }

      if (playerOneCorrect && playerTwoCorrect) {
        return { success: true as const, message: "Oboje trafiliście poprawnie." };
      }

      if (playerOneCorrect || playerTwoCorrect) {
        return { success: true as const, message: "Punkt wpada tylko jednej osobie." };
      }

      return { success: true as const, message: "Tym razem nikt nie zdobył punktu." };
    },
  });
}

export async function restartScienceQuiz(
  roomCode: string,
  currentUserId: string,
  options?: {
    resetToWaiting?: boolean;
  },
) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
        where: { roomCode: normalizedRoomCode },
      }),
    missingMessage: "Nie znaleziono gry do restartu.",
    execute: async ({ game, staleResult }) => {
      if (!isGameParticipant(game, currentUserId)) {
        return { success: false as const, message: "Nie należysz do tej gry." };
      }

      const resetToWaiting = options?.resetToWaiting ?? false;
      const canStartNow = Boolean(game.playerOneId && game.playerTwoId) && !resetToWaiting;
      const restarted = await applyVersionedGameUpdate(
        prisma.scienceQuizGame,
        game,
        {},
        {
          status: canStartNow ? "question" : "waiting",
          playerOneJoined: resetToWaiting ? false : Boolean(game.playerOneId),
          playerTwoJoined: resetToWaiting ? false : Boolean(game.playerTwoId),
          playerOneScore: 0,
          playerTwoScore: 0,
          roundIndex: 0,
          questionOrder: getFreshQuestionOrder(normalizeScienceQuizCategory(game.category)),
          playerOneAnswer: null,
          playerTwoAnswer: null,
          questionStartedAt: canStartNow ? new Date() : null,
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

      return { success: true as const, message: "Nowy quiz jest gotowy." };
    },
  });
}

export async function pauseScienceQuiz(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
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
        prisma.scienceQuizGame,
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

export async function resumeScienceQuiz(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
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
        prisma.scienceQuizGame,
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

export async function requestScienceQuizExit(roomCode: string, currentUserId: string) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
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
        prisma.scienceQuizGame,
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

export async function respondScienceQuizExit(
  roomCode: string,
  currentUserId: string,
  approve: boolean,
) {
  return runGameCommand({
    roomCode,
    loadGame: (normalizedRoomCode) =>
      prisma.scienceQuizGame.findUnique({
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
          prisma.scienceQuizGame,
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
        prisma.scienceQuizGame,
        game,
        { exitRequestedById: game.exitRequestedById },
        {
          status: "waiting",
          playerOneJoined: false,
          playerTwoJoined: false,
          playerOneScore: 0,
          playerTwoScore: 0,
          roundIndex: 0,
          questionOrder: getFreshQuestionOrder(normalizeScienceQuizCategory(game.category)),
          playerOneAnswer: null,
          playerTwoAnswer: null,
          questionStartedAt: null,
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
