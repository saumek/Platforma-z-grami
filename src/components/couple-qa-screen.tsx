"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { GameHeaderShell } from "@/components/game-header-shell";
import { GameReactionDrawer } from "@/components/game-reaction-drawer";
import { useGameStateSync } from "@/components/use-game-state-sync";
import { useGameSessionControls } from "@/components/use-game-session-controls";
import type { AuthResponse } from "@/types/auth";

type CoupleQaStatus = "waiting" | "question" | "round_result" | "finished";

type CoupleQaState = {
  roomCode: string;
  status: CoupleQaStatus;
  currentUserId: string;
  roundIndex: number;
  totalRounds: number;
  compatibilityScore: number;
  compatibilityThreshold: number;
  compatibilityFill: number;
  question: {
    text: string;
    options: string[];
  } | null;
  currentPlayer: {
    id: string;
    name: string;
    avatarPath: string | null;
    roomPoints: number;
    answered: boolean;
  } | null;
  opponent: {
    id: string;
    name: string;
    avatarPath: string | null;
    roomPoints: number;
    answered: boolean;
  } | null;
  currentAnswer: number | null;
  opponentAnswered: boolean;
  questionEndsAt: number | null;
  lastMatch: boolean | null;
  resultRevealedUntil: number | null;
  isEligibleForBonus: boolean;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

type CoupleQaScreenProps = {
  roomCode: string;
  hasJoinedRoom: boolean;
  initialState: CoupleQaState | null;
};

const QUESTION_TIMER_SECONDS = 30;
function Avatar({
  src,
  alt,
  accent,
}: {
  src: string | null;
  alt: string;
  accent: "cyan" | "pink";
}) {
  const ringClass =
    accent === "cyan"
      ? "from-secondary to-primary"
      : "from-error to-primary";

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

function HeartMeter({
  fill,
}: {
  fill: number;
}) {
  const clampedFill = Math.max(0, Math.min(1, fill));
  const reveal = `${(1 - clampedFill) * 100}%`;

  return (
    <div className="relative flex items-center justify-center">
      <span className="material-symbols-outlined absolute text-4xl text-error/20">favorite</span>
      <span
        className="material-symbols-outlined compat-heart-beat text-4xl text-error drop-shadow-[0_0_8px_rgba(255,110,132,0.6)] transition-[clip-path] duration-700 ease-out"
        style={{
          fontVariationSettings: '"FILL" 1',
          clipPath: `inset(${reveal} 0 0 0)`,
        }}
      >
        favorite
      </span>
      <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_#00e3fd]" />
    </div>
  );
}

function ResultScreen({
  score,
  totalRounds,
  isEligibleForBonus,
  onRematch,
  onBackToMenu,
  isRestarting,
}: {
  score: number;
  totalRounds: number;
  isEligibleForBonus: boolean;
  onRematch: () => void;
  onBackToMenu: () => void;
  isRestarting: boolean;
}) {
  const headline = isEligibleForBonus ? "Pełen match" : "Może rewanż?";
  const body =
    score >= 9
      ? "Weszliście w ten sam rytm niemal przez całą serię."
      : score >= 8
        ? "Bardzo wysoka zgodność. Oboje zgarnęliście punkt pokoju."
        : score >= 5
          ? "Jest chemia, ale jeszcze zostało trochę nieprzewidywalności."
          : "Tym razem bardziej kontrast niż pełna kompatybilność.";

  return (
    <main className="app-screen-root app-main-with-nav mobile-safe-top flex flex-col bg-surface-dim px-8 pt-28 text-on-surface">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
        <div className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-surface-container-low">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,110,132,0.18),transparent_68%)] blur-xl" />
          <span
            className="material-symbols-outlined compat-bounce relative z-10 text-[4.5rem] text-error drop-shadow-[0_0_14px_rgba(255,110,132,0.35)]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            favorite
          </span>
        </div>

        <p className="mb-3 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
          Wynik końcowy
        </p>
        <h1 className="compat-bounce text-center font-headline text-5xl font-bold tracking-tight text-on-surface">
          {headline}
        </h1>
        <p className="mt-4 max-w-sm text-center text-sm leading-6 text-on-surface-variant">
          {body}
        </p>

        <div className="mt-10 w-full rounded-[2rem] bg-surface-container-low px-6 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                Zgodność
              </p>
              <p className="mt-2 font-headline text-4xl font-bold text-on-surface">
                {score}/{totalRounds}
              </p>
            </div>
            <div className="rounded-full bg-surface-container-high px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-tertiary-dim">
                {isEligibleForBonus ? "+1 pkt pokój" : "bez bonusu"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex w-full flex-col gap-4">
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

export function CoupleQaScreen({
  roomCode,
  hasJoinedRoom,
  initialState,
}: CoupleQaScreenProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMER_SECONDS);
  const { state, setState, refreshState } = useGameStateSync<CoupleQaState>({
    initialState,
    statePath: "/api/games/couple-qa/state",
    startPath: "/api/games/couple-qa/start",
    intervalMs: 1200,
    getNextRefreshAt: (currentState) =>
      currentState?.status === "question"
        ? currentState.questionEndsAt
        : currentState?.status === "round_result"
          ? currentState.resultRevealedUntil
          : null,
  });

  useEffect(() => {
    if (state?.status !== "question") {
      setTimeLeft(QUESTION_TIMER_SECONDS);
      return;
    }

    if (!state.questionEndsAt) {
      setTimeLeft(QUESTION_TIMER_SECONDS);
      return;
    }

    const endsAt = state.questionEndsAt;
    const referenceNow = state.isPaused && state.pausedAt ? state.pausedAt : Date.now();
    const initialTime = Math.max(0, (endsAt - referenceNow) / 1000);
    setTimeLeft(initialTime);

    if (state.isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextTime = Math.max(0, (endsAt - Date.now()) / 1000);
      setTimeLeft(nextTime);
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state?.status, state?.roundIndex, state?.question?.text, state?.questionEndsAt, state?.isPaused, state?.pausedAt]);

  const answerProgress = Math.max(0, Math.min(100, (timeLeft / QUESTION_TIMER_SECONDS) * 100));

  const currentAnswerLabel = useMemo(() => {
    if (!state?.question || state.currentAnswer === null) {
      return null;
    }

    return state.question.options[state.currentAnswer] ?? null;
  }, [state]);
  const gameSessionControls = useGameSessionControls({
    gamePath: "couple-qa",
    state,
    refreshState,
    setStatusMessage,
  });

  async function handleAnswer(answerIndex: number) {
    if (!state || state.status !== "question" || state.currentAnswer !== null) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/games/couple-qa/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answerIndex }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się zapisać odpowiedzi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestart() {
    setIsRestarting(true);

    try {
      const response = await fetch("/api/games/couple-qa/restart", {
        method: "POST",
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się przygotować rewanżu.");
    } finally {
      setIsRestarting(false);
    }
  }

  async function handleBackToMenu() {
    setIsRestarting(true);

    try {
      await fetch("/api/games/couple-qa/restart", {
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
          score={state.compatibilityScore}
          totalRounds={state.totalRounds}
          isEligibleForBonus={state.isEligibleForBonus}
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

          <HeartMeter fill={state?.compatibilityFill ?? 0} />

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
        <div className="relative mb-12 w-full max-w-md">
          <div className="absolute -left-10 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-[80px]" />
          <div className="absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-[80px]" />

          <div className="relative z-10 text-center">
            <div className="mb-5 inline-block rounded-full bg-surface-container-high px-3.5 py-1">
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                Runda {Math.min(state?.roundIndex ?? 1, state?.totalRounds ?? 10)} /{" "}
                {state?.totalRounds ?? 10}
              </span>
            </div>

            <h1 className="px-1 font-headline text-[1.95rem] font-bold leading-[1.08] tracking-tight text-on-surface sm:text-3xl">
              {state?.status === "waiting"
                ? "Czekamy, aż druga osoba wejdzie do gry"
                : state?.question?.text ?? "Ładowanie pytania..."}
            </h1>

            <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-secondary" />
          </div>
        </div>

        {state?.status === "waiting" ? (
          <div className="w-full max-w-md rounded-[2rem] bg-surface-container-low px-6 py-7 text-center">
            <p className="text-sm leading-6 text-on-surface-variant">
              Gdy druga osoba otworzy tę grę, od razu zacznie się pierwsza runda i wylosuje się nowy zestaw pytań.
            </p>
          </div>
        ) : (
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            {state?.question?.options.map((option, index) => {
              const isSelected = state.currentAnswer === index;
              const isDisabled =
                isSubmitting || state.status !== "question" || state.currentAnswer !== null;

              return (
                <button
                  key={`${state.roundIndex}-${index}`}
                  className={`group relative flex h-30 items-center justify-center rounded-[1.1rem] bg-surface-container-low p-4 transition-all duration-300 active:scale-95 ${
                    isSelected ? "bg-surface-container-high shadow-[0_0_0_1px_rgba(0,227,253,0.25)]" : ""
                  }`}
                  type="button"
                  onClick={() => handleAnswer(index)}
                  disabled={isDisabled}
                >
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-secondary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative z-10 text-center">
                    <span className="font-body text-[15px] font-semibold leading-snug text-on-surface">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-10 w-full max-w-md">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="font-label text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
              Czas odpowiedzi
            </span>
            <span className="font-label text-[10px] font-bold text-tertiary-dim">
              {state?.status === "waiting"
                ? "--"
                : state?.status === "round_result"
                  ? "OK"
                  : `${Math.ceil(timeLeft)}s`}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full rounded-full bg-tertiary-dim shadow-[0_0_10px_rgba(190,238,0,0.4)] transition-[width] duration-150"
              style={{
                width:
                  state?.status === "waiting"
                    ? "0%"
                    : state?.status === "round_result"
                      ? "100%"
                      : `${answerProgress}%`,
              }}
            />
          </div>
        </div>

        {statusMessage ? (
          <p className="mt-4 max-w-md text-center text-sm text-on-surface-variant">{statusMessage}</p>
        ) : null}

        {state?.status === "round_result" ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-8 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[2rem] bg-surface-container-low px-6 py-7 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
                <span
                  className={`material-symbols-outlined text-3xl ${
                    state.lastMatch ? "text-error" : "text-secondary"
                  }`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {state.lastMatch ? "favorite" : "compare_arrows"}
                </span>
              </div>
              <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
                {state.lastMatch ? "Pełna zgodność" : "Różne odpowiedzi"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                {state.lastMatch
                  ? "Serce się wypełniło, bo odpowiedzieliście tak samo."
                  : "Tym razem wasze odpowiedzi się rozjechały."}
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-tertiary-dim">
                {currentAnswerLabel ?? "Odpowiedź zapisana"}
              </p>
            </div>
          </div>
        ) : null}
      </main>

      {gameSessionControls.overlay}
      <GameReactionDrawer />

      <AppBottomNav active="games" hasJoinedRoom={hasJoinedRoom} compact />
    </div>
  );
}
