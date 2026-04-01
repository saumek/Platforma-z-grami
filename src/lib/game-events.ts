import { EventEmitter } from "node:events";

type GameEventPayload = {
  roomCode: string;
  at: number;
};

const GAME_EVENT_NAME = "game-state-changed";

function getGameEventEmitter() {
  const globalWithEmitter = globalThis as typeof globalThis & {
    __gamelyGameEventEmitter?: EventEmitter;
  };

  if (!globalWithEmitter.__gamelyGameEventEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalWithEmitter.__gamelyGameEventEmitter = emitter;
  }

  return globalWithEmitter.__gamelyGameEventEmitter;
}

export function publishGameEvent(roomCode: string) {
  getGameEventEmitter().emit(GAME_EVENT_NAME, {
    roomCode,
    at: Date.now(),
  } satisfies GameEventPayload);
}

export function subscribeToGameEvents(
  roomCode: string,
  listener: (payload: GameEventPayload) => void,
) {
  const emitter = getGameEventEmitter();
  const wrappedListener = (payload: GameEventPayload) => {
    if (payload.roomCode === roomCode) {
      listener(payload);
    }
  };

  emitter.on(GAME_EVENT_NAME, wrappedListener);

  return () => {
    emitter.off(GAME_EVENT_NAME, wrappedListener);
  };
}
