import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { pruneInactiveUsersFromRoom } from "@/lib/room-cleanup";

type RoomScoreboardEntry = {
  id: string;
  name: string;
  points: number;
};

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
      Object.entries(parsed).flatMap(([key, points]) =>
        Number.isFinite(points) ? [[key, Number(points)]] : [],
      ),
    );
  } catch {
    return {} as Record<string, number>;
  }
}

export async function getRoomUsersWithScores(roomCode: string) {
  await pruneInactiveUsersFromRoom(roomCode);

  const roomUsers = await prisma.user.findMany({
    where: { currentRoomCode: roomCode },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
    orderBy: { createdAt: "asc" },
    take: 4,
  });

  const [battleshipGame, coupleQaGame, scienceQuizGame, ludoGame] = await Promise.all([
    prisma.battleshipGame.findUnique({
      where: { roomCode },
      select: {
        playerOneId: true,
        playerTwoId: true,
        playerOneWins: true,
        playerTwoWins: true,
      },
    }),
    prisma.coupleQaGame.findUnique({
      where: { roomCode },
      select: {
        playerOneId: true,
        playerTwoId: true,
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
      },
    }),
    prisma.scienceQuizGame.findUnique({
      where: { roomCode },
      select: {
        playerOneId: true,
        playerTwoId: true,
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
      },
    }),
    prisma.ludoGame.findUnique({
      where: { roomCode },
      select: {
        playerOneId: true,
        playerTwoId: true,
        playerOneRoomPoints: true,
        playerTwoRoomPoints: true,
        roomPointsByUser: true,
      },
    }),
  ]);

  const scoreboard = new Map<string, number>();

  function addPoints(userId: string | null | undefined, points: number | null | undefined) {
    if (!userId || !points) {
      return;
    }

    scoreboard.set(userId, (scoreboard.get(userId) ?? 0) + points);
  }

  addPoints(battleshipGame?.playerOneId, battleshipGame?.playerOneWins);
  addPoints(battleshipGame?.playerTwoId, battleshipGame?.playerTwoWins);
  addPoints(coupleQaGame?.playerOneId, coupleQaGame?.playerOneRoomPoints);
  addPoints(coupleQaGame?.playerTwoId, coupleQaGame?.playerTwoRoomPoints);
  addPoints(scienceQuizGame?.playerOneId, scienceQuizGame?.playerOneRoomPoints);
  addPoints(scienceQuizGame?.playerTwoId, scienceQuizGame?.playerTwoRoomPoints);
  const ludoRoomPoints = parsePointsMap(ludoGame?.roomPointsByUser);
  if (Object.keys(ludoRoomPoints).length > 0) {
    Object.entries(ludoRoomPoints).forEach(([userId, points]) => {
      addPoints(userId, points);
    });
  } else {
    addPoints(ludoGame?.playerOneId, ludoGame?.playerOneRoomPoints);
    addPoints(ludoGame?.playerTwoId, ludoGame?.playerTwoRoomPoints);
  }

  const users = roomUsers.map(
    (user) =>
      ({
        id: user.id,
        name: user.displayName ?? defaultDisplayName(user.email),
        points: scoreboard.get(user.id) ?? 0,
      }) satisfies RoomScoreboardEntry,
  );

  return {
    activeUsersCount: users.length,
    users,
  };
}
