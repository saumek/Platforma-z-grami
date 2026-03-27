import qaQuestions from "@/data/qa-lightning.json";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

const TOTAL_ROUNDS = 10;
const QUESTION_TIMER_MS = 15_000;
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

async function advanceResolvedRound(roomCode: string) {
  const game = await prisma.coupleQaGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
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

    return prisma.coupleQaGame.update({
      where: { id: game.id },
      data: {
        status: "round_result",
        compatibilityScore: matched ? { increment: 1 } : undefined,
        lastMatch: matched,
        roundResolvedAt: new Date(),
        questionStartedAt: null,
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
    const shouldGrantReward = game.compatibilityScore >= 8 && !game.rewardGranted;

    return prisma.coupleQaGame.update({
      where: { id: game.id },
      data: {
        status: "finished",
        playerOneRoomPoints: shouldGrantReward ? { increment: 1 } : undefined,
        playerTwoRoomPoints: shouldGrantReward ? { increment: 1 } : undefined,
        questionStartedAt: null,
        rewardGranted: shouldGrantReward ? true : game.rewardGranted,
      },
    });
  }

  return prisma.coupleQaGame.update({
    where: { id: game.id },
    data: {
      status: "question",
      roundIndex: { increment: 1 },
      playerOneAnswer: null,
      playerTwoAnswer: null,
      questionStartedAt: new Date(),
      lastMatch: null,
      roundResolvedAt: null,
    },
  });
}

export async function ensureCoupleQaGame(roomCode: string) {
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
    },
  });
}

export async function getCoupleQaState(roomCode: string, currentUserId: string) {
  await ensureCoupleQaGame(roomCode);

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
  } satisfies CoupleQaState;
}

export async function startCoupleQaGame(roomCode: string, currentUserId: string) {
  await ensureCoupleQaGame(roomCode);

  const game = await prisma.coupleQaGame.findUnique({
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

  const joinedUpdate = isPlayerOne ? { playerOneJoined: true } : { playerTwoJoined: true };
  const joinedGame = await prisma.coupleQaGame.update({
    where: { id: game.id },
    data: joinedUpdate,
  });

  if (
    joinedGame.status === "waiting" &&
    haveBothJoined(joinedGame)
  ) {
    return prisma.coupleQaGame.update({
      where: { id: joinedGame.id },
      data: {
        status: "question",
        questionStartedAt: new Date(),
      },
    });
  }

  return joinedGame;
}

export async function submitCoupleQaAnswer(roomCode: string, currentUserId: string, answerIndex: number) {
  const game = await advanceResolvedRound(roomCode);

  if (!game) {
    return { success: false as const, message: "Nie znaleziono gry." };
  }

  if (game.status !== "question") {
    return { success: false as const, message: "Poczekaj na kolejną rundę." };
  }

  const questionOrder = parseQuestionOrder(game.questionOrder);
  const question = questionOrder[game.roundIndex] !== undefined ? getQuestionPool()[questionOrder[game.roundIndex]!] : null;

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

  const updated = await prisma.coupleQaGame.update({
    where: { id: game.id },
    data: isPlayerOne ? { playerOneAnswer: answerIndex } : { playerTwoAnswer: answerIndex },
  });

  const playerOneAnswer = isPlayerOne ? answerIndex : updated.playerOneAnswer;
  const playerTwoAnswer = isPlayerOne ? updated.playerTwoAnswer : answerIndex;

  if (playerOneAnswer === null || playerTwoAnswer === null) {
    return { success: true as const, message: "Odpowiedź zapisana. Czekamy na drugą osobę." };
  }

  const matched = playerOneAnswer === playerTwoAnswer;

  await prisma.coupleQaGame.update({
    where: { id: game.id },
    data: {
      status: "round_result",
      compatibilityScore: matched ? { increment: 1 } : undefined,
      lastMatch: matched,
      roundResolvedAt: new Date(),
    },
  });

  return {
    success: true as const,
    message: matched ? "Macie zgodność!" : "Tym razem odpowiedzi się różniły.",
  };
}

export async function restartCoupleQaGame(roomCode: string, currentUserId: string) {
  const game = await prisma.coupleQaGame.findUnique({
    where: { roomCode },
  });

  if (!game) {
    return { success: false as const, message: "Nie znaleziono gry do restartu." };
  }

  if (game.playerOneId !== currentUserId && game.playerTwoId !== currentUserId) {
    return { success: false as const, message: "Nie należysz do tej gry." };
  }

  await prisma.coupleQaGame.update({
    where: { id: game.id },
    data: {
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
    },
  });

  return { success: true as const, message: "Nowa seria pytań jest gotowa." };
}

export async function getRoomScoreTotals(roomCode: string) {
  const [battleshipGame, coupleQaGame, scienceQuizGame] = await Promise.all([
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
  ]);

  return {
    userOnePoints:
      (battleshipGame?.playerOneWins ?? 0) +
      (coupleQaGame?.playerOneRoomPoints ?? 0) +
      (scienceQuizGame?.playerOneRoomPoints ?? 0),
    userTwoPoints:
      (battleshipGame?.playerTwoWins ?? 0) +
      (coupleQaGame?.playerTwoRoomPoints ?? 0) +
      (scienceQuizGame?.playerTwoRoomPoints ?? 0),
  };
}
