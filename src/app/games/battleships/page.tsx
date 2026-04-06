import { redirect } from "next/navigation";

import { BattleshipsScreen } from "@/components/battleships-screen";
import { getCurrentSession } from "@/lib/auth";
import { getBattleshipState } from "@/lib/battleships";
import { isUserWithinRoomPlayerLimit } from "@/lib/game-player-limit";
import { prisma } from "@/lib/prisma";

export default async function BattleshipsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentRoomCode: true,
    },
  });

  if (!user?.currentRoomCode) {
    redirect("/profile");
  }

  const isEligiblePlayer = await isUserWithinRoomPlayerLimit(
    user.currentRoomCode,
    session.user.id,
    2,
  );

  if (!isEligiblePlayer) {
    redirect("/games");
  }

  const initialState = await getBattleshipState(user.currentRoomCode, session.user.id, {
    resetTerminated: true,
  });

  return (
    <BattleshipsScreen
      roomCode={user.currentRoomCode}
      hasJoinedRoom
      initialState={initialState}
    />
  );
}
