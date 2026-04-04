import {
  getDopowiedzeniaState,
  pauseDopowiedzeniaGame,
  resumeDopowiedzeniaGame,
} from "@/lib/dopowiedzenia";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { action?: "pause" | "resume" }),
    command: ({ roomCode, userId, body }) =>
      body.action === "resume"
        ? resumeDopowiedzeniaGame(roomCode, userId)
        : pauseDopowiedzeniaGame(roomCode, userId),
    getState: ({ roomCode, userId }) => getDopowiedzeniaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zmienić stanu gry.",
  });
}
