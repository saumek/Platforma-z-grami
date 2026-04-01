import { getCoupleQaState, pauseCoupleQaGame, resumeCoupleQaGame } from "@/lib/couple-qa";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { action?: "pause" | "resume" }),
    command: ({ roomCode, userId, body }) =>
      body.action === "resume"
        ? resumeCoupleQaGame(roomCode, userId)
        : pauseCoupleQaGame(roomCode, userId),
    getState: ({ roomCode, userId }) => getCoupleQaState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zmienić stanu gry.",
  });
}
