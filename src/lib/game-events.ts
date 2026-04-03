import { EventEmitter } from "node:events";

export type GameReactionKind = "confetti" | "hearts" | "sad" | "fire";

type BaseGameEventPayload = {
  roomCode: string;
  at: number;
};

export type GameStateEventPayload = BaseGameEventPayload & {
  type: "state";
};

export type GameReactionEventPayload = BaseGameEventPayload & {
  type: "reaction";
  reaction: GameReactionKind;
  actorId: string;
};

export type GameEventPayload = GameStateEventPayload | GameReactionEventPayload;

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
    type: "state",
    roomCode,
    at: Date.now(),
  } satisfies GameEventPayload);
}

export function publishGameReaction(
  roomCode: string,
  reaction: GameReactionKind,
  actorId: string,
) {
  getGameEventEmitter().emit(GAME_EVENT_NAME, {
    type: "reaction",
    roomCode,
    reaction,
    actorId,
    at: Date.now(),
  } satisfies GameReactionEventPayload);
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
