import scienceGeografia from "@/data/science-quiz/geografia.json";
import scienceMatma from "@/data/science-quiz/matma.json";
import scienceNauka from "@/data/science-quiz/nauka.json";
import scienceWiedzaOgolna from "@/data/science-quiz/wiedza-ogolna.json";
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

async function advanceScienceQuizLifecycle(roomCode: string) {
  const game = await prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
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

    return prisma.scienceQuizGame.update({
      where: { id: game.id },
      data: {
        status: "round_result",
        playerOneScore: playerOneCorrect ? { increment: 1 } : undefined,
        playerTwoScore: playerTwoCorrect ? { increment: 1 } : undefined,
        questionStartedAt: null,
        roundResolvedAt: new Date(),
      },
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

    return prisma.scienceQuizGame.update({
      where: { id: game.id },
      data: {
        status: "finished",
        playerOneRoomPoints: shouldGrantPlayerOnePoint ? { increment: 1 } : undefined,
        playerTwoRoomPoints: shouldGrantPlayerTwoPoint ? { increment: 1 } : undefined,
        questionStartedAt: null,
        rewardGranted: winnerId !== null ? true : game.rewardGranted,
      },
    });
  }

  return prisma.scienceQuizGame.update({
    where: { id: game.id },
    data: {
      status: "question",
      roundIndex: { increment: 1 },
      playerOneAnswer: null,
      playerTwoAnswer: null,
      questionStartedAt: new Date(),
      roundResolvedAt: null,
    },
  });
}

export async function ensureScienceQuizGame(
  roomCode: string,
  requestedCategory: string | null | undefined,
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
  await ensureScienceQuizGame(roomCode, requestedCategory);

  const game = await prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return null;
  }

  const isPlayerOne = game.playerOneId === currentUserId;
  const isPlayerTwo = game.playerTwoId === currentUserId;

  if (!isPlayerOne && !isPlayerTwo) {
    return game;
  }

  const joinedGame = await prisma.scienceQuizGame.update({
    where: { id: game.id },
    data: isPlayerOne ? { playerOneJoined: true } : { playerTwoJoined: true },
  });

  if (joinedGame.status === "waiting" && haveBothJoined(joinedGame)) {
    return prisma.scienceQuizGame.update({
      where: { id: joinedGame.id },
      data: {
        status: "question",
        questionStartedAt: new Date(),
      },
    });
  }

  return joinedGame;
}

export async function getScienceQuizState(
  roomCode: string,
  currentUserId: string,
  requestedCategory: string | null | undefined,
) {
  await ensureScienceQuizGame(roomCode, requestedCategory);

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
  } satisfies ScienceQuizState;
}

export async function submitScienceQuizAnswer(
  roomCode: string,
  currentUserId: string,
  answerIndex: number,
) {
  const game = await advanceScienceQuizLifecycle(roomCode);

  if (!game) {
    return { success: false as const, message: "Nie znaleziono gry." };
  }

  if (game.status !== "question") {
    return { success: false as const, message: "Poczekaj na kolejną rundę." };
  }

  const category = normalizeScienceQuizCategory(game.category);
  const questionOrder = parseQuestionOrder(game.questionOrder);
  const questionIndex = questionOrder[game.roundIndex];
  const question =
    questionIndex !== undefined ? getQuestionPool(category)[questionIndex] : null;

  if (!question || answerIndex < 0 || answerIndex >= question.options.length) {
    return { success: false as const, message: "Wybrano nieprawidłową odpowiedź." };
  }

  const isPlayerOne = game.playerOneId === currentUserId;

  if (!isPlayerOne && game.playerTwoId !== currentUserId) {
    return { success: false as const, message: "Nie należysz do tej gry." };
  }

  const currentAnswer = isPlayerOne ? game.playerOneAnswer : game.playerTwoAnswer;

  if (currentAnswer !== null) {
    return { success: false as const, message: "Na to pytanie już odpowiedziałeś." };
  }

  const updated = await prisma.scienceQuizGame.update({
    where: { id: game.id },
    data: isPlayerOne ? { playerOneAnswer: answerIndex } : { playerTwoAnswer: answerIndex },
  });

  const playerOneAnswer = isPlayerOne ? answerIndex : updated.playerOneAnswer;
  const playerTwoAnswer = isPlayerOne ? updated.playerTwoAnswer : answerIndex;

  if (playerOneAnswer === null || playerTwoAnswer === null) {
    return { success: true as const, message: "Odpowiedź zapisana. Czekamy na drugą osobę." };
  }

  const playerOneCorrect = playerOneAnswer === question.correctIndex;
  const playerTwoCorrect = playerTwoAnswer === question.correctIndex;

  await prisma.scienceQuizGame.update({
    where: { id: game.id },
    data: {
      status: "round_result",
      playerOneScore: playerOneCorrect ? { increment: 1 } : undefined,
      playerTwoScore: playerTwoCorrect ? { increment: 1 } : undefined,
      questionStartedAt: null,
      roundResolvedAt: new Date(),
    },
  });

  if (playerOneCorrect && playerTwoCorrect) {
    return { success: true as const, message: "Oboje trafiliście poprawnie." };
  }

  if (playerOneCorrect || playerTwoCorrect) {
    return { success: true as const, message: "Punkt wpada tylko jednej osobie." };
  }

  return { success: true as const, message: "Tym razem nikt nie zdobył punktu." };
}

export async function restartScienceQuiz(roomCode: string, currentUserId: string) {
  const game = await prisma.scienceQuizGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return { success: false as const, message: "Nie znaleziono gry do restartu." };
  }

  if (game.playerOneId !== currentUserId && game.playerTwoId !== currentUserId) {
    return { success: false as const, message: "Nie należysz do tej gry." };
  }

  const canStartNow = Boolean(game.playerOneId && game.playerTwoId);

  await prisma.scienceQuizGame.update({
    where: { id: game.id },
    data: {
      status: canStartNow ? "question" : "waiting",
      playerOneJoined: Boolean(game.playerOneId),
      playerTwoJoined: Boolean(game.playerTwoId),
      playerOneScore: 0,
      playerTwoScore: 0,
      roundIndex: 0,
      questionOrder: getFreshQuestionOrder(normalizeScienceQuizCategory(game.category)),
      playerOneAnswer: null,
      playerTwoAnswer: null,
      questionStartedAt: canStartNow ? new Date() : null,
      roundResolvedAt: null,
      rewardGranted: false,
    },
  });

  return { success: true as const, message: "Nowy quiz jest gotowy." };
}
