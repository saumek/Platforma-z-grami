import { describe, expect, it, vi } from "vitest";

import { publishGameEvent, subscribeToGameEvents } from "./game-events";

describe("game events", () => {
  it("publishes only to listeners in the same room", () => {
    const roomListener = vi.fn();
    const otherRoomListener = vi.fn();

    const unsubscribeRoom = subscribeToGameEvents("ROOM-1", roomListener);
    const unsubscribeOther = subscribeToGameEvents("ROOM-2", otherRoomListener);

    publishGameEvent("ROOM-1");

    expect(roomListener).toHaveBeenCalledTimes(1);
    expect(roomListener.mock.calls[0]?.[0]).toMatchObject({
      roomCode: "ROOM-1",
      at: expect.any(Number),
    });
    expect(otherRoomListener).not.toHaveBeenCalled();

    unsubscribeRoom();
    unsubscribeOther();
  });

  it("stops emitting after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGameEvents("ROOM-3", listener);

    unsubscribe();
    publishGameEvent("ROOM-3");

    expect(listener).not.toHaveBeenCalled();
  });
});
