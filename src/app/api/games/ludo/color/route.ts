import { runGameCommandRoute } from "@/lib/game-command-route";
import { chooseLudoColor, getLudoGameState } from "@/lib/ludo";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { color?: string }),
    command: ({ roomCode, userId, body }) => chooseLudoColor(roomCode, userId, body.color ?? ""),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    errorMessage: "Nie udało się zapisać koloru.",
  });
}
