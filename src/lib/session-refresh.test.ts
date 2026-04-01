import { describe, expect, it } from "vitest";

import { SESSION_REFRESH_WINDOW_MS, shouldRefreshSession } from "./session-refresh";

describe("shouldRefreshSession", () => {
  it("does not refresh when a lot of time remains", () => {
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_REFRESH_WINDOW_MS + 10 * 60 * 1000);

    expect(shouldRefreshSession(expiresAt, now)).toBe(false);
  });

  it("refreshes when less than 5 minutes remain", () => {
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_REFRESH_WINDOW_MS - 1_000);

    expect(shouldRefreshSession(expiresAt, now)).toBe(true);
  });

  it("does not refresh when the session already expired", () => {
    const now = Date.now();
    const expiresAt = new Date(now - 1_000);

    expect(shouldRefreshSession(expiresAt, now)).toBe(false);
  });
});
