import { getBattleshipState, shootBattleship } from "@/lib/battleships";
import { runGameCommandRoute } from "@/lib/game-command-route";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { target?: number }),
    command: ({ roomCode, userId, body }) => shootBattleship(roomCode, userId, body.target ?? -1),
    getState: ({ roomCode, userId }) => getBattleshipState(roomCode, userId),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się oddać strzału.",
  });
}
