import { redirect } from "next/navigation";

import { GamesScreen } from "@/components/games-screen";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoomUsersWithScores } from "@/lib/room-scoreboard";

export default async function GamesPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentRoomCode: true,
    },
  });

  if (!currentUser?.currentRoomCode) {
    redirect("/profile");
  }

  const roomState = await getRoomUsersWithScores(currentUser.currentRoomCode);

  return (
    <GamesScreen
      roomCode={currentUser.currentRoomCode}
      activeUsersCount={roomState.activeUsersCount}
      users={roomState.users}
    />
  );
}
