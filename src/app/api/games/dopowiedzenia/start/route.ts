import { runGameCommandRoute } from "@/lib/game-command-route";
import { getDopowiedzeniaState, startDopowiedzeniaGame } from "@/lib/dopowiedzenia";

export async function POST() {
  return runGameCommandRoute({
    command: async ({ roomCode, userId }) => {
      await startDopowiedzeniaGame(roomCode, userId);
      return { success: true, message: "Uruchomiono Dopowiedzenia." };
    },
    getState: ({ roomCode, userId }) => getDopowiedzeniaState(roomCode, userId),
    errorMessage: "Nie udało się uruchomić gry.",
  });
}
