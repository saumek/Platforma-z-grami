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

type DopowiedzeniaState = {
  roomCode: string;
  status: DopowiedzeniaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  isInitialRound: boolean;
  playerOneName: string | null;
  playerTwoName: string | null;
  promptWords: string[];
  promptSourceName: string | null;
  currentPlayer: {
    id: string;
    name: string;
    avatarPath: string | null;
    submitted: boolean;
  } | null;
  opponent: {
    id: string;
    name: string;
    avatarPath: string | null;
    submitted: boolean;
  } | null;
  currentInput: string;
  otherSubmitted: boolean;
  revealEndsAt: number | null;
  playerOneStory: string;
  playerTwoStory: string;
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
            Dwie wersje tej samej zabawy
          </h1>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">
            Oto pełne historie, które zbudowaliście naprzemiennie przez wszystkie rundy.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <article className="rounded-[1.75rem] bg-surface-container-low px-5 py-5">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary">
              Historia rozpoczęta przez {state.playerOneName ?? "Użytkownika 1"}
            </p>
            <p className="mt-3 text-sm leading-7 text-on-surface">
              {state.playerOneStory || "Ta historia nie została jeszcze ułożona."}
            </p>
          </article>

          <article className="rounded-[1.75rem] bg-surface-container-low px-5 py-5">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-error">
              Historia rozpoczęta przez {state.playerTwoName ?? "Użytkownika 2"}
            </p>
            <p className="mt-3 text-sm leading-7 text-on-surface">
              {state.playerTwoStory || "Ta historia nie została jeszcze ułożona."}
            </p>
          </article>
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
        <div className="relative flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex flex-col items-center gap-1">
            <Avatar
              src={state?.currentPlayer?.avatarPath ?? null}
              alt={state?.currentPlayer?.name ?? "Ty"}
              accent="cyan"
            />
            <span className="font-label text-[9px] font-bold tracking-tight text-primary">
              {state?.currentPlayer?.name ?? "Użytkownik 1"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <div className="rounded-full bg-surface-container-high px-3 py-1">
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                Runda {Math.min(state?.roundIndex ?? 1, state?.totalRounds ?? 5)} /{" "}
                {state?.totalRounds ?? 5}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Avatar
              src={state?.opponent?.avatarPath ?? null}
              alt={state?.opponent?.name ?? "Druga osoba"}
              accent="pink"
            />
            <span className="font-label text-[9px] font-bold tracking-tight text-error">
              {state?.opponent?.name ?? "Użytkownik 2"}
            </span>
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
                  ? "Czekamy, aż druga osoba wejdzie do Dopowiedzeń"
                  : state?.isInitialRound
                    ? "Napisz początek historii"
                    : state?.status === "reveal"
                      ? "Nowa podpowiedź już leci"
                      : "Dopisz dalszy ciąg historii"}
              </h1>
              <div className="mx-auto mt-5 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-secondary" />
            </div>

            {state?.status === "waiting" ? (
              <div className="mt-10 rounded-[2rem] bg-surface-container-low px-6 py-7 text-center">
                <p className="text-sm leading-6 text-on-surface-variant">
                  Gdy druga osoba otworzy tę grę, oboje od razu zaczniecie pisać własne początki historii.
                </p>
              </div>
            ) : state?.status === "reveal" ? (
              <div className="mt-10 rounded-[2rem] bg-surface-container-low px-6 py-7 text-center shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <p className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary">
                  Kolejna podpowiedź od {state.promptSourceName ?? "drugiej osoby"}
                </p>
                <p className="mt-5 font-headline text-2xl font-bold tracking-tight text-on-surface">
                  {promptLine ? `"${promptLine}"` : "Historia zmienia kierunek"}
                </p>
                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  Za chwilę zobaczysz pole do kolejnego dopowiedzenia.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {state?.promptWords.length ? (
                  <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-4">
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary">
                      Ostatnie 3 słowa od {state.promptSourceName ?? "drugiej osoby"}
                    </p>
                    <p className="mt-3 font-headline text-xl font-bold tracking-tight text-on-surface">
                      {promptLine}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-[2rem] bg-surface-container-low p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                  <textarea
                    className="min-h-[13.5rem] w-full resize-none rounded-[1.4rem] border border-outline-variant/12 bg-surface-container px-4 py-4 text-[15px] leading-7 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary/30"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      state?.isInitialRound
                        ? "Zacznij historię po swojemu..."
                        : "Dopisz kolejny kawałek tej historii..."
                    }
                    disabled={isSubmitting || state?.currentPlayer?.submitted}
                  />

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs leading-5 text-on-surface-variant">
                      {state?.currentPlayer?.submitted
                        ? "Twoja część historii jest już zapisana. Czekamy na drugą osobę."
                        : state?.otherSubmitted
                          ? `${state.opponent?.name ?? "Druga osoba"} już skończyła pisać.`
                          : "Druga osoba jeszcze pisze."}
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
              <p className="mt-4 text-center text-sm text-on-surface-variant">{statusMessage}</p>
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
