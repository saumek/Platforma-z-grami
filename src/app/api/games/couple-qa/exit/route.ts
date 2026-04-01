import { getCoupleQaState, requestCoupleQaExit, respondCoupleQaExit } from "@/lib/couple-qa";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as {
        action?: "request" | "respond";
        approve?: boolean;
      }),
    command: ({ roomCode, userId, body }) =>
      body.action === "respond"
        ? respondCoupleQaExit(roomCode, userId, Boolean(body.approve))
        : requestCoupleQaExit(roomCode, userId),
    getState: ({ roomCode, userId }) => getCoupleQaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się obsłużyć zakończenia gry.",
  });
}
