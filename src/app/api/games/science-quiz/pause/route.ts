import { runGameCommandRoute } from "@/lib/game-command-route";
import {
  getScienceQuizState,
  pauseScienceQuiz,
  resumeScienceQuiz,
} from "@/lib/science-quiz";

export async function POST(request: Request) {
  return runGameCommandRoute({
    request,
    parseBody: async (currentRequest) =>
      ((await currentRequest.json().catch(() => ({}))) as {
        action?: "pause" | "resume";
      }),
    command: ({ roomCode, userId, body }) =>
      body.action === "resume"
        ? resumeScienceQuiz(roomCode, userId)
        : pauseScienceQuiz(roomCode, userId),
    getState: ({ roomCode, userId }) => getScienceQuizState(roomCode, userId, null),
    notInRoomMessage: "Nie jesteś obecnie w żadnym pokoju.",
    errorMessage: "Nie udało się zmienić stanu gry.",
  });
}
