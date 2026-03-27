import { redirect } from "next/navigation";

import { ScienceQuizScreen } from "@/components/science-quiz-screen";
import { getCurrentSession } from "@/lib/auth";
import { getScienceQuizState } from "@/lib/science-quiz";
import { normalizeScienceQuizCategory } from "@/lib/science-quiz-categories";
import { prisma } from "@/lib/prisma";

export default async function ScienceQuizPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
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

  const { category } = await params;
  const normalizedCategory = normalizeScienceQuizCategory(category);
  const initialState = await getScienceQuizState(
    user.currentRoomCode,
    session.user.id,
    normalizedCategory,
  );

  return (
    <ScienceQuizScreen
      roomCode={user.currentRoomCode}
      category={normalizedCategory}
      hasJoinedRoom
      initialState={initialState}
    />
  );
}
