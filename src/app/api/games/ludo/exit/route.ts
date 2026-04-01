import { getLudoGameState, handleLudoExit } from "@/lib/ludo";
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
      handleLudoExit(
        roomCode,
        userId,
        body.action === "respond" ? "respond" : "request",
        body.approve,
      ),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się obsłużyć zakończenia gry.",
  });
}
