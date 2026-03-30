import { redirect } from "next/navigation";

import { LudoScreen } from "@/components/ludo-screen";
import { getCurrentSession } from "@/lib/auth";
import { getLudoGameState } from "@/lib/ludo";
import { prisma } from "@/lib/prisma";

export default async function LudoPage() {
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

  const initialState = await getLudoGameState(user.currentRoomCode, session.user.id, {
    resetTerminated: true,
  });

  return <LudoScreen roomCode={user.currentRoomCode} initialState={initialState} hasJoinedRoom />;
}

