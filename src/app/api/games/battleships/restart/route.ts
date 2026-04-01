import { getBattleshipState, restartBattleshipRound } from "@/lib/battleships";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST() {
  return runGameCommandRoute({
    command: ({ roomCode, userId }) => restartBattleshipRound(roomCode, userId),
    getState: ({ roomCode, userId }) => getBattleshipState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się przygotować rewanżu.",
  });
}
