import { redirect } from "next/navigation";

import { BattleshipsScreen } from "@/components/battleships-screen";
import { getCurrentSession } from "@/lib/auth";
import { getBattleshipState } from "@/lib/battleships";
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

  const initialState = await getBattleshipState(user.currentRoomCode, session.user.id);

  return (
    <BattleshipsScreen
      roomCode={user.currentRoomCode}
      hasJoinedRoom
      initialState={initialState}
    />
  );
}
