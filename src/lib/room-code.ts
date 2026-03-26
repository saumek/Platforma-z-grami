export function normalizeRoomCode(code: string) {
  return code.trim().replace(/^#/, "").toUpperCase();
}

export function formatRoomCode(code: string | null | undefined) {
  return code ? `#${code}` : "";
}
