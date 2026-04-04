import { redirect } from "next/navigation";

import { DopowiedzeniaScreen } from "@/components/dopowiedzenia-screen";
import { getCurrentSession } from "@/lib/auth";
import { getDopowiedzeniaState } from "@/lib/dopowiedzenia";
import { prisma } from "@/lib/prisma";

export default async function DopowiedzeniaPage() {
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

  const initialState = await getDopowiedzeniaState(user.currentRoomCode, session.user.id, {
    resetTerminated: true,
  });

  return (
    <DopowiedzeniaScreen
      roomCode={user.currentRoomCode}
      hasJoinedRoom
      initialState={initialState}
    />
  );
}
