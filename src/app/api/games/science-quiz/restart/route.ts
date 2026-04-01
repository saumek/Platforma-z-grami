import { runGameCommandRoute } from "@/lib/game-command-route";
import { getScienceQuizState, restartScienceQuiz } from "@/lib/science-quiz";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as {
        mode?: "menu" | "rematch";
      }),
    command: ({ roomCode, userId, body }) =>
      restartScienceQuiz(roomCode, userId, {
        resetToWaiting: body.mode === "menu",
      }),
    getState: ({ roomCode, userId }) => getScienceQuizState(roomCode, userId, null),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się przygotować nowego quizu.",
  });
}
