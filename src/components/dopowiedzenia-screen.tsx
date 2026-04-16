"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { GameHeaderShell } from "@/components/game-header-shell";
import { GameReactionDrawer } from "@/components/game-reaction-drawer";
import { useGameSessionControls } from "@/components/use-game-session-controls";
import { useGameStateSync } from "@/components/use-game-state-sync";
import type { AuthResponse } from "@/types/auth";

type DopowiedzeniaStatus = "waiting" | "writing" | "reveal" | "finished";

type DopowiedzeniaPlayer = {
  id: string;
  name: string;
  avatarPath: string | null;
  submitted: boolean;
};

type DopowiedzeniaState = {
  roomCode: string;
  status: DopowiedzeniaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  isInitialRound: boolean;
  minPlayers: number;
  maxPlayers: number;
  joinedCount: number;
  promptWords: string[];
  promptSourceName: string | null;
  players: DopowiedzeniaPlayer[];
  currentPlayer: DopowiedzeniaPlayer | null;
  otherPlayers: DopowiedzeniaPlayer[];
  currentInput: string;
  otherSubmittedCount: number;
  revealEndsAt: number | null;
  stories: Array<{
    ownerId: string;
    ownerName: string;
    text: string;
  }>;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

type DopowiedzeniaScreenProps = {
  roomCode: string;
  hasJoinedRoom: boolean;
  initialState: DopowiedzeniaState | null;
};

function Avatar({
  src,
  alt,
  accent,
}: {
  src: string | null;
  alt: string;
  accent: "cyan" | "pink";
}) {
  const ringClass = accent === "cyan" ? "from-secondary to-primary" : "from-error to-primary";

  return (
    <div className={`h-12 w-12 rounded-full bg-gradient-to-tr p-0.5 ${ringClass}`}>
      {src ? (
        <Image
          alt={alt}
          className="h-full w-full rounded-full bg-surface-container object-cover"
          src={src}
          width={48}
          height={48}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-container">
          <span className="material-symbols-outlined text-lg text-on-surface">person</span>
        </div>
      )}
    </div>
  );
}

function PlayerBadge({
  player,
  accent,
}: {
  player: DopowiedzeniaPlayer;
  accent: "cyan" | "pink";
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Avatar src={player.avatarPath} alt={player.name} accent={accent} />
      <span
        className={`max-w-[4.8rem] truncate text-center font-label text-[9px] font-bold tracking-tight ${
          accent === "cyan" ? "text-primary" : "text-error"
        }`}
      >
        {player.name}
      </span>
    </div>
  );
}

function WaitingRoster({ players }: { players: DopowiedzeniaPlayer[] }) {
  if (!players.length) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
      {players.map((player, index) => (
        <div
          key={player.id}
          className="flex items-center gap-2 text-xs text-on-surface-variant"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
            {index + 1}
          </span>
          <span>{player.name}</span>
        </div>
      ))}
    </div>
  );
}

function ResultScreen({
  state,
  onRematch,
  onBackToMenu,
  isRestarting,
}: {
  state: DopowiedzeniaState;
  onRematch: () => void;
  onBackToMenu: () => void;
  isRestarting: boolean;
}) {
  return (
    <main className="app-screen-root app-main-with-nav mobile-safe-top flex flex-col bg-surface-dim px-6 pt-24 text-on-surface">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="text-center">
          <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            Finał historii
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-on-surface">
            Gotowe opowieści
          </h1>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">
            Oto pełne historie, które zbudowaliście naprzemiennie przez wszystkie rundy.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {state.stories.map((story, index) => (
            <article
              key={story.ownerId}
              className={`${index > 0 ? "border-t border-white/8 pt-6" : ""}`}
            >
              <p
                className={`font-label text-[10px] uppercase tracking-[0.18em] ${
                  index % 2 === 0 ? "text-secondary" : "text-error"
                }`}
              >
                Historia rozpoczęta przez {story.ownerName}
              </p>
              <p className="mt-3 text-[15px] leading-8 text-on-surface">
                {story.text || "Ta historia nie została jeszcze ułożona."}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <button
            className="w-full rounded-full bg-gradient-to-r from-primary to-primary-dim py-5 font-headline text-base font-bold uppercase tracking-[0.08em] text-on-primary-fixed transition-transform duration-200 active:scale-[0.98] disabled:opacity-60"
            type="button"
            onClick={onRematch}
            disabled={isRestarting}
          >
            {isRestarting ? "Przygotowuję..." : "Spróbuj ponownie"}
          </button>
          <button
            className="w-full rounded-full bg-surface-container-high py-5 font-headline text-base font-bold uppercase tracking-[0.08em] text-on-surface transition-transform duration-200 active:scale-[0.98]"
            type="button"
            onClick={onBackToMenu}
          >
            Wróć do menu
          </button>
        </div>
      </div>
      <AppBottomNav active="games" hasJoinedRoom />
    </main>
  );
}

export function DopowiedzeniaScreen({
  roomCode,
  hasJoinedRoom,
  initialState,
}: DopowiedzeniaScreenProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const { state, refreshState } = useGameStateSync<DopowiedzeniaState>({
    initialState,
    statePath: "/api/games/dopowiedzenia/state",
    startPath: "/api/games/dopowiedzenia/start",
    intervalMs: 1200,
    getNextRefreshAt: (currentState) =>
      currentState?.status === "reveal" ? currentState.revealEndsAt : null,
  });

  const draftSyncKey = `${state?.status ?? "idle"}:${state?.roundIndex ?? 0}:${state?.currentPlayer?.submitted ? "submitted" : "open"}`;

  useEffect(() => {
    setDraft(state?.currentInput ?? "");
  }, [draftSyncKey, state?.currentInput]);

  const gameSessionControls = useGameSessionControls({
    gamePath: "dopowiedzenia",
    state,
    refreshState,
    setStatusMessage,
  });

  const promptLine = useMemo(() => {
    if (!state?.promptWords.length) {
      return "";
    }

    return state.promptWords.join(" ");
  }, [state?.promptWords]);

  const currentPlayer = state?.currentPlayer ?? null;
  const otherPlayers = state?.otherPlayers ?? [];
  const roundLabel = `${Math.min(state?.roundIndex ?? 1, state?.totalRounds ?? 5)} / ${state?.totalRounds ?? 5}`;

  async function handleSubmit() {
    if (!state || state.status !== "writing" || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/games/dopowiedzenia/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: draft }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się zapisać tej części historii.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestart() {
    setIsRestarting(true);

    try {
      const response = await fetch("/api/games/dopowiedzenia/restart", {
        method: "POST",
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się przygotować nowej serii historii.");
    } finally {
      setIsRestarting(false);
    }
  }

  async function handleBackToMenu() {
    setIsRestarting(true);

    try {
      await fetch("/api/games/dopowiedzenia/restart", {
        method: "POST",
      });
    } catch {
      // Ignore restart failure and still allow leaving the screen.
    } finally {
      setIsRestarting(false);
      router.push("/games");
    }
  }

  if (state?.status === "finished") {
    return (
      <>
        <ResultScreen
          state={state}
          onRematch={handleRestart}
          onBackToMenu={handleBackToMenu}
          isRestarting={isRestarting}
        />
        <GameReactionDrawer />
      </>
    );
  }

  return (
    <div className="app-screen-root bg-surface-dim font-body text-on-surface">
      <GameHeaderShell roomCode={roomCode} showRoomLabel divider fixed>
        <div className="relative flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {currentPlayer ? <PlayerBadge player={currentPlayer} accent="cyan" /> : null}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1 text-center">
            <div className="rounded-full bg-surface-container-high px-3 py-1">
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                Runda {roundLabel}
              </span>
            </div>
            <span className="font-label text-[9px] uppercase tracking-[0.16em] text-on-surface-variant">
              {state?.joinedCount ?? 0}/{state?.maxPlayers ?? 4} osób
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
            {otherPlayers.slice(0, 3).map((player) => (
              <PlayerBadge key={player.id} player={player} accent="pink" />
            ))}
          </div>

          {gameSessionControls.pauseButtonVisible ? (
            <button
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-primary shadow-[0_0_14px_rgba(182,160,255,0.18)] active:scale-95"
              type="button"
              onClick={gameSessionControls.requestPause}
              disabled={gameSessionControls.pauseButtonDisabled}
            >
              <span className="material-symbols-outlined text-[20px]">pause</span>
            </button>
          ) : null}
        </div>
      </GameHeaderShell>

      <main className="mobile-safe-top-offset-lg app-main-with-nav-compact flex min-h-screen flex-col items-center justify-center px-6 sm:px-8">
        <div className="relative w-full max-w-md">
          <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-[80px]" />
          <div className="absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-[80px]" />

          <div className="relative z-10">
            <div className="text-center">
              <h1 className="font-headline text-[1.95rem] font-bold leading-[1.08] tracking-tight text-on-surface sm:text-3xl">
                {state?.status === "waiting"
                  ? "Czekamy, aż dołączą kolejne osoby do Dopowiedzeń"
                  : state?.isInitialRound
                    ? "Napisz początek historii"
                    : state?.status === "reveal"
                      ? "Nowa podpowiedź już leci"
                      : "Dopisz dalszy ciąg historii"}
              </h1>
              <div className="mx-auto mt-5 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-secondary" />
            </div>

            {state?.status === "waiting" ? (
              <div className="mt-10 text-center">
                <p className="text-sm leading-6 text-on-surface-variant">
                  Gdy w tej grze będą przynajmniej {state.minPlayers} osoby, wszyscy od razu zaczną pisać własne początki historii.
                </p>
                <WaitingRoster players={state.players} />
              </div>
            ) : state?.status === "reveal" ? (
              <div className="mt-10 text-center">
                <p className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary">
                  Kolejna podpowiedź od {state.promptSourceName ?? "kolejnej osoby"}
                </p>
                <div className="mt-6">
                  <p className="font-headline text-[2rem] font-bold tracking-tight text-on-surface">
                    {promptLine ? `"${promptLine}"` : "Historia zmienia kierunek"}
                  </p>
                  <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  Za chwilę zobaczysz pole do kolejnego dopowiedzenia.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-5">
                {state?.promptWords.length ? (
                  <div className="text-center">
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary/90">
                      Ostatnie 5 słów od {state.promptSourceName ?? "kolejnej osoby"}
                    </p>
                    <p className="mt-3 font-headline text-[1.85rem] font-bold tracking-tight text-on-surface">
                      {promptLine}
                    </p>
                    <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-secondary/45 to-transparent" />
                  </div>
                ) : null}

                <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-4 py-4 backdrop-blur-md">
                  <textarea
                    className="min-h-[13rem] w-full resize-none bg-transparent px-1 py-2 text-[15px] leading-8 text-on-surface outline-none placeholder:text-on-surface-variant/55"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      state?.isInitialRound
                        ? "Zacznij historię po swojemu..."
                        : "Dopisz kolejny kawałek tej historii..."
                    }
                    disabled={isSubmitting || state?.currentPlayer?.submitted}
                  />

                  <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs leading-5 text-on-surface-variant/85">
                      {state?.currentPlayer?.submitted
                        ? "Twoja część historii jest już zapisana. Czekamy na pozostałe osoby."
                        : (state?.otherSubmittedCount ?? 0) > 0
                          ? `${state?.otherSubmittedCount} ${(state?.otherSubmittedCount ?? 0) === 1 ? "osoba już skończyła" : "osoby już skończyły"} pisać.`
                          : "Pozostałe osoby jeszcze piszą."}
                    </p>

                    <button
                      className="rounded-full bg-gradient-to-r from-primary to-primary-dim px-5 py-3 font-headline text-sm font-bold uppercase tracking-[0.08em] text-on-primary-fixed transition-transform duration-200 active:scale-[0.98] disabled:opacity-60"
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting || Boolean(state?.currentPlayer?.submitted)}
                    >
                      {state?.currentPlayer?.submitted
                        ? "Zapisane"
                        : isSubmitting
                          ? "Wysyłam..."
                          : "Dalej"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {statusMessage ? (
              <p className="mt-4 text-center text-sm text-on-surface-variant/90">{statusMessage}</p>
            ) : null}
          </div>
        </div>
      </main>

      {gameSessionControls.overlay}
      <GameReactionDrawer />
      <AppBottomNav active="games" hasJoinedRoom={hasJoinedRoom} compact />
    </div>
  );
}
