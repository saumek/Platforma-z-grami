import type { GameReactionKind } from "@/lib/game-events";

export const GAME_REACTIONS = [
  { kind: "confetti", emoji: "🎉", label: "Konfetti" },
  { kind: "hearts", emoji: "❤️", label: "Serce" },
  { kind: "sad", emoji: "😢", label: "Smutek" },
  { kind: "fire", emoji: "🔥", label: "Ogień" },
] as const satisfies ReadonlyArray<{
  kind: GameReactionKind;
  emoji: string;
  label: string;
}>;

export function isGameReactionKind(value: unknown): value is GameReactionKind {
  return typeof value === "string" && GAME_REACTIONS.some((reaction) => reaction.kind === value);
}
