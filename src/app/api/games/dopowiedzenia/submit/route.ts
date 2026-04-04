import { runGameCommandRoute } from "@/lib/game-command-route";
import { getDopowiedzeniaState, submitDopowiedzeniaText } from "@/lib/dopowiedzenia";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { text?: string }),
    command: ({ roomCode, userId, body }) =>
      submitDopowiedzeniaText(roomCode, userId, body.text ?? ""),
    getState: ({ roomCode, userId }) => getDopowiedzeniaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zapisać historii.",
  });
}
