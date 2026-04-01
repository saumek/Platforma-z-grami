import { runGameCommandRoute } from "@/lib/game-command-route";
import { getCoupleQaState, startCoupleQaGame } from "@/lib/couple-qa";

export async function POST() {
  return runGameCommandRoute({
    command: async ({ roomCode, userId }) => {
      await startCoupleQaGame(roomCode, userId);
      return { success: true, message: "Uruchomiono pytania dla par." };
    },
    getState: ({ roomCode, userId }) => getCoupleQaState(roomCode, userId),
    errorMessage: "Nie udało się uruchomić gry.",
  });
}
