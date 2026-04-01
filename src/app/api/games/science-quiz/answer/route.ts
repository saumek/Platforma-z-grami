import { runGameCommandRoute } from "@/lib/game-command-route";
import { getScienceQuizState, submitScienceQuizAnswer } from "@/lib/science-quiz";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { answerIndex?: number }),
    command: ({ roomCode, userId, body }) =>
      submitScienceQuizAnswer(roomCode, userId, body.answerIndex ?? -1),
    getState: ({ roomCode, userId }) => getScienceQuizState(roomCode, userId, null),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zapisać odpowiedzi.",
  });
}
