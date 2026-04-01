import {
  getBattleshipState,
  pauseBattleshipGame,
  resumeBattleshipGame,
} from "@/lib/battleships";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as {
        action?: "pause" | "resume";
      }),
    command: ({ roomCode, userId, body }) =>
      body.action === "resume"
        ? resumeBattleshipGame(roomCode, userId)
        : pauseBattleshipGame(roomCode, userId),
    getState: ({ roomCode, userId }) => getBattleshipState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zmienić stanu gry.",
  });
}
