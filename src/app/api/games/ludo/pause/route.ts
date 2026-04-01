import { getLudoGameState, setLudoPauseState } from "@/lib/ludo";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { action?: "pause" | "resume" }),
    command: ({ roomCode, userId, body }) =>
      setLudoPauseState(roomCode, userId, body.action === "resume" ? "resume" : "pause"),
    getState: ({ roomCode, userId }) => getLudoGameState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zmienić stanu gry.",
  });
}
