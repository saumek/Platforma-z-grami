export const SESSION_DURATION_MS = 1000 * 60 * 60;
export const SESSION_REFRESH_WINDOW_MS = 1000 * 60 * 5;

export function shouldRefreshSession(expiresAt: Date, now = Date.now()) {
  const remainingMs = expiresAt.getTime() - now;

  return remainingMs > 0 && remainingMs <= SESSION_REFRESH_WINDOW_MS;
}
