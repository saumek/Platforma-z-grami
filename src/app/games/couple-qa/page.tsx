import { redirect } from "next/navigation";

import { CoupleQaScreen } from "@/components/couple-qa-screen";
import { getCurrentSession } from "@/lib/auth";
import { getCoupleQaState } from "@/lib/couple-qa";
import { isUserWithinRoomPlayerLimit } from "@/lib/game-player-limit";
import { prisma } from "@/lib/prisma";

export default async function CoupleQaPage() {
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

  const initialState = await getCoupleQaState(user.currentRoomCode, session.user.id, {
    resetTerminated: true,
  });

  return (
    <CoupleQaScreen
      roomCode={user.currentRoomCode}
      hasJoinedRoom
      initialState={initialState}
    />
  );
}
