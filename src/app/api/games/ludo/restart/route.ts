import { getLudoGameState, restartLudo } from "@/lib/ludo";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { mode?: "menu" | "rematch" }),
    command: ({ roomCode, userId, body }) =>
      restartLudo(roomCode, userId, {
        resetToWaiting: body.mode === "menu",
      }),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się przygotować nowej partii.",
  });
}
