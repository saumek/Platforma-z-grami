import { runGameCommandRoute } from "@/lib/game-command-route";
import { startScienceQuizGame, getScienceQuizState } from "@/lib/science-quiz";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as { category?: string }),
    command: async ({ roomCode, userId, body }) => {
      await startScienceQuizGame(roomCode, userId, body.category);
      return { success: true, message: "Uruchomiono quiz naukowy." };
    },
    getState: ({ roomCode, userId, body }) => getScienceQuizState(roomCode, userId, body.category),
    errorMessage: "Nie udało się uruchomić quizu.",
  });
}
