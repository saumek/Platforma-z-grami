import { normalizeRoomCode } from "@/lib/room-code";

export type GameCommandResult = {
  success: boolean;
  message: string;
};

type RunGameCommandArgs<TGame, TResult extends GameCommandResult> = {
  roomCode: string;
  loadGame: (normalizedRoomCode: string) => Promise<TGame | null>;
  missingMessage: string;
  execute: (context: {
    game: TGame;
    normalizedRoomCode: string;
    staleResult: (message?: string) => TResult;
  }) => Promise<TResult>;
};

type VersionedGameRecord = {
  id: string;
  version: number;
};

type PlayerBoundGameRecord = {
  playerOneId: string | null;
  playerTwoId: string | null;
};

type UpdateManyDelegate = {
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
};

const DEFAULT_STALE_MESSAGE = "Stan gry właśnie się zmienił. Spróbuj ponownie.";

export async function runGameCommand<TGame, TResult extends GameCommandResult>({
  roomCode,
  loadGame,
  missingMessage,
  execute,
}: RunGameCommandArgs<TGame, TResult>): Promise<TResult> {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const game = await loadGame(normalizedRoomCode);

  if (!game) {
    return { success: false, message: missingMessage } as TResult;
  }

  return execute({
    game,
    normalizedRoomCode,
    staleResult: (message = DEFAULT_STALE_MESSAGE) =>
      ({ success: false, message }) as TResult,
  });
}

export function isGameParticipant(game: PlayerBoundGameRecord, userId: string) {
  return game.playerOneId === userId || game.playerTwoId === userId;
}

export async function applyVersionedGameUpdate(
  delegate: UpdateManyDelegate,
  game: VersionedGameRecord,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  const updateResult = await delegate.updateMany({
    where: {
      id: game.id,
      version: game.version,
      ...where,
    },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });

  return updateResult.count > 0;
}
