import { runGameCommandRoute } from "@/lib/game-command-route";
import { getLudoGameState, moveLudoToken } from "@/lib/ludo";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { tokenIndex?: number }),
    command: ({ roomCode, userId, body }) => moveLudoToken(roomCode, userId, Number(body.tokenIndex)),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    errorMessage: "Nie udało się wykonać ruchu.",
  });
}
