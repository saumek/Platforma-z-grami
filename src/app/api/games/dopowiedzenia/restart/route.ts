import { runGameCommandRoute } from "@/lib/game-command-route";
import { getDopowiedzeniaState, restartDopowiedzeniaGame } from "@/lib/dopowiedzenia";

export async function POST() {
  return runGameCommandRoute({
    command: ({ roomCode, userId }) => restartDopowiedzeniaGame(roomCode, userId),
    getState: ({ roomCode, userId }) => getDopowiedzeniaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się przygotować nowej rundy.",
  });
}
