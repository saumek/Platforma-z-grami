import { runGameCommandRoute } from "@/lib/game-command-route";
import { ensureBattleshipGame, getBattleshipState } from "@/lib/battleships";

export async function POST() {
  return runGameCommandRoute({
    command: async ({ roomCode }) => {
      await ensureBattleshipGame(roomCode, { resetTerminated: true });
      return { success: true, message: "Uruchomiono grę Statki 5x5." };
    },
    getState: ({ roomCode, userId }) => getBattleshipState(roomCode, userId),
    errorMessage: "Nie udało się uruchomić gry.",
  });
}
