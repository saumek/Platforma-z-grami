import { runGameCommandRoute } from "@/lib/game-command-route";
import { getLudoGameState, rollLudoDice } from "@/lib/ludo";

export async function POST() {
  return runGameCommandRoute({
    command: ({ roomCode, userId }) => rollLudoDice(roomCode, userId),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    errorMessage: "Nie udało się rzucić kostką.",
  });
}
