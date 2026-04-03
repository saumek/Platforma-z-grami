"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { GAME_REACTIONS } from "@/lib/game-reactions";
import type { GameReactionKind } from "@/lib/game-events";

type ActiveReaction = {
  id: string;
  kind: GameReactionKind;
  actorId: string;
};

export function GameReactionDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ActiveReaction | null>(null);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource("/api/games/events");

    const handleReaction = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          roomCode: string;
          reaction: GameReactionKind;
          actorId: string;
          at: number;
        };

        const nextReaction = {
          id: `${payload.at}-${payload.actorId}-${payload.reaction}`,
          kind: payload.reaction,
          actorId: payload.actorId,
        } satisfies ActiveReaction;

        setActiveReaction(nextReaction);

        window.setTimeout(() => {
          setActiveReaction((current) => (current?.id === nextReaction.id ? null : current));
        }, 7200);
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    eventSource.addEventListener("reaction", handleReaction as EventListener);

    return () => {
      eventSource.removeEventListener("reaction", handleReaction as EventListener);
      eventSource.close();
    };
  }, []);

  async function handleSendReaction(reaction: GameReactionKind) {
    if (isSending) {
      return;
    }

    setIsSending(true);

    try {
      await fetch("/api/games/reaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reaction }),
      });
      setIsOpen(false);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <div className="fixed right-0 top-1/2 z-[60] -translate-y-1/2">
        <div
          className={`flex items-center gap-2 rounded-l-2xl border border-white/8 bg-black/50 py-2 pr-2 pl-1 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-[11.75rem]"
          }`}
        >
          <button
            className="flex h-10 w-6 items-center justify-center rounded-l-xl text-on-surface-variant active:scale-95"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-label={isOpen ? "Schowaj reakcje" : "Pokaż reakcje"}
          >
            <span className={`material-symbols-outlined text-[20px] transition-transform ${isOpen ? "rotate-180" : ""}`}>
              chevron_left
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {GAME_REACTIONS.map((reaction) => (
              <button
                key={reaction.kind}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-200 hover:bg-white/12 active:scale-95 disabled:opacity-50"
                type="button"
                onClick={() => void handleSendReaction(reaction.kind)}
                disabled={isSending}
                aria-label={reaction.label}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ReactionBurst reaction={activeReaction} />
    </>
  );
}

function ReactionBurst({ reaction }: { reaction: ActiveReaction | null }) {
  const particles = useMemo(() => {
    if (!reaction) {
      return [];
    }

    const seed = Array.from(reaction.id).reduce(
      (value, char, index) => value + char.charCodeAt(0) * (index + 1),
      0,
    );

    function pseudoRandom(index: number) {
      const value = Math.sin(seed * 0.137 + index * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    }

    return Array.from({ length: 40 }, (_, index) => {
      const progress = pseudoRandom(index + 1);
      const drift = pseudoRandom(index + 2);
      const sway = pseudoRandom(index + 3);

      return {
        id: index,
        fromX: 4 + progress * 92,
        driftX: -6 + drift * 12,
        driftY: -(126 + sway * 18),
        delay: index * 45,
        duration: 5200,
        size: 0.9 + pseudoRandom(index + 5) * 0.28,
        rotate: -12 + pseudoRandom(index + 6) * 24,
      };
    });
  }, [reaction]);

  if (!reaction) {
    return null;
  }

  const emoji =
    GAME_REACTIONS.find((item) => item.kind === reaction.kind)?.emoji ?? "✨";

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <div className="game-reaction-flash absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(182,160,255,0.16),transparent_48%)]" />
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <span
            key={`${reaction.id}-${particle.id}`}
            className="game-reaction-particle absolute"
            style={
              {
                left: `${particle.fromX}%`,
                top: "100%",
                "--particle-x": `${particle.driftX}vw`,
                "--particle-y": `${particle.driftY}vh`,
                animationDelay: `${particle.delay}ms`,
                animationDuration: `${particle.duration}ms`,
              } as CSSProperties
            }
          >
            <span
              className="game-reaction-glyph block"
              style={
                {
                  "--reaction-scale": particle.size,
                  "--reaction-rotate": `${particle.rotate}deg`,
                  fontSize: "1.55rem",
                } as CSSProperties
              }
            >
              {emoji}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
