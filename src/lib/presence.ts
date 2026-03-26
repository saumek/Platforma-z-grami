export function isActiveNow(expiresAt: Date) {
  return expiresAt > new Date();
}
