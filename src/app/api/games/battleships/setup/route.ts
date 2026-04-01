import { getBattleshipState, saveBattleshipPlacement } from "@/lib/battleships";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { board?: number[][] }),
    command: ({ roomCode, userId, body }) =>
      saveBattleshipPlacement(roomCode, userId, Array.isArray(body.board) ? body.board : []),
    getState: ({ roomCode, userId }) => getBattleshipState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zapisać ustawienia statków.",
  });
}
