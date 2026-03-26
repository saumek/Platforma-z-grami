import { redirect } from "next/navigation";

import { GamesScreen } from "@/components/games-screen";
import { getCurrentSession } from "@/lib/auth";
import { defaultDisplayName } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export default async function GamesPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentRoomCode: true,
      email: true,
      displayName: true,
    },
  });

  if (!currentUser?.currentRoomCode) {
    redirect("/profile");
  }

  const roomUsers = await prisma.user.findMany({
    where: { currentRoomCode: currentUser.currentRoomCode },
    select: {
      email: true,
      displayName: true,
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  const labels = roomUsers.map((user) => user.displayName ?? defaultDisplayName(user.email));
  const fallbackCurrentName = currentUser.displayName ?? defaultDisplayName(currentUser.email);
  const battleshipGame = await prisma.battleshipGame.findUnique({
    where: { roomCode: currentUser.currentRoomCode },
    select: {
      playerOneId: true,
      playerTwoId: true,
      playerOneWins: true,
      playerTwoWins: true,
    },
  });

  return (
    <GamesScreen
      roomCode={currentUser.currentRoomCode}
      activeUsersCount={roomUsers.length}
      userOne={labels[0] ?? fallbackCurrentName}
      userTwo={labels[1] ?? "Oczekiwanie..."}
      userOneWins={battleshipGame?.playerOneWins ?? 0}
      userTwoWins={battleshipGame?.playerTwoWins ?? 0}
    />
  );
}
