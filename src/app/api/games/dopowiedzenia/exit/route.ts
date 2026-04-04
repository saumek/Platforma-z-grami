import {
  getDopowiedzeniaState,
  requestDopowiedzeniaExit,
  respondDopowiedzeniaExit,
} from "@/lib/dopowiedzenia";
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
        ? respondDopowiedzeniaExit(roomCode, userId, Boolean(body.approve))
        : requestDopowiedzeniaExit(roomCode, userId),
    getState: ({ roomCode, userId }) => getDopowiedzeniaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się obsłużyć zakończenia gry.",
  });
}
