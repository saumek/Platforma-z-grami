import { runGameCommandRoute } from "@/lib/game-command-route";
import {
  getScienceQuizState,
  requestScienceQuizExit,
  respondScienceQuizExit,
} from "@/lib/science-quiz";

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
        ? respondScienceQuizExit(roomCode, userId, Boolean(body.approve))
        : requestScienceQuizExit(roomCode, userId),
    getState: ({ roomCode, userId }) => getScienceQuizState(roomCode, userId, null),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się obsłużyć zakończenia gry.",
  });
}
