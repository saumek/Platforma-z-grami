import { runGameCommandRoute } from "@/lib/game-command-route";
import { getLudoGameState, startLudoGame } from "@/lib/ludo";

export async function POST() {
  return runGameCommandRoute({
    command: async ({ roomCode, userId }) => {
      await startLudoGame(roomCode, userId);
      return { success: true, message: "Uruchomiono Chińczyka." };
    },
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    errorMessage: "Nie udało się uruchomić gry.",
  });
}
