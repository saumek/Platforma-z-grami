import { runGameCommandRoute } from "@/lib/game-command-route";
import { getCoupleQaState, submitCoupleQaAnswer } from "@/lib/couple-qa";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { answerIndex?: number }),
    command: ({ roomCode, userId, body }) => submitCoupleQaAnswer(roomCode, userId, body.answerIndex ?? -1),
    getState: ({ roomCode, userId }) => getCoupleQaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zapisać odpowiedzi.",
  });
}
