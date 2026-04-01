import { getCoupleQaState, restartCoupleQaGame } from "@/lib/couple-qa";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST() {
  return runGameCommandRoute({
    command: ({ roomCode, userId }) => restartCoupleQaGame(roomCode, userId),
    getState: ({ roomCode, userId }) => getCoupleQaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się przygotować nowej serii pytań.",
  });
}
