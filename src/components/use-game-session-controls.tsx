"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { GamePauseOverlay } from "@/components/game-pause-overlay";
import type { AuthResponse } from "@/types/auth";

type SharedGameSessionState = {
  status: string;
  isPaused: boolean;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

type UseGameSessionControlsArgs<TState extends SharedGameSessionState> = {
  gamePath: string;
  state: TState | null;
  refreshState: () => Promise<void>;
  setStatusMessage: (message: string) => void;
};

export function useGameSessionControls<TState extends SharedGameSessionState>({
  gamePath,
  state,
  refreshState,
  setStatusMessage,
}: UseGameSessionControlsArgs<TState>) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (state?.shouldReturnToMenu) {
      router.push("/games");
      router.refresh();
    }
  }, [router, state?.shouldReturnToMenu]);

  async function handlePause(action: "pause" | "resume") {
    setIsBusy(true);

    try {
      const response = await fetch(`/api/games/${gamePath}/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się zmienić stanu gry.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleExit(action: "request" | "respond", approve?: boolean) {
    setIsBusy(true);

    try {
      const response = await fetch(`/api/games/${gamePath}/exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, approve }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się obsłużyć zakończenia gry.");
    } finally {
      setIsBusy(false);
    }
  }

  const overlay = (
    <GamePauseOverlay
      isOpen={Boolean(state?.isPaused)}
      title={state?.exitRequestedByName ? "Zakończyć grę?" : "Gra wstrzymana"}
      description={
        state?.exitRequestedByName
          ? state.canRespondToExit
            ? `${state.exitRequestedByName} chce zakończyć grę. Czy zgadzasz się na wyjście?`
            : "Czekamy na decyzję drugiej osoby w sprawie zakończenia gry."
          : state?.pauseRequestedByName
            ? `${state.pauseRequestedByName} wstrzymał grę. Możesz wznowić albo poprosić o zakończenie.`
            : "Gra jest obecnie wstrzymana."
      }
      primaryLabel={
        state?.exitRequestedByName
          ? state.canRespondToExit
            ? "Tak, zakończ"
            : undefined
          : "Wznów"
      }
      onPrimary={
        state?.exitRequestedByName
          ? state.canRespondToExit
            ? () => handleExit("respond", true)
            : undefined
          : () => handlePause("resume")
      }
      secondaryLabel={
        state?.exitRequestedByName
          ? state.canRespondToExit
            ? "Zostań w grze"
            : undefined
          : "Wyjdź z gry"
      }
      onSecondary={
        state?.exitRequestedByName
          ? state.canRespondToExit
            ? () => handleExit("respond", false)
            : undefined
          : () => handleExit("request")
      }
      isBusy={isBusy}
      infoLabel={state?.exitRequestedByName && !state.canRespondToExit ? "Oczekiwanie na potwierdzenie" : undefined}
    />
  );

  return {
    isBusy,
    pauseButtonVisible: Boolean(state && state.status !== "waiting" && state.status !== "finished"),
    pauseButtonDisabled: isBusy || !state || state.isPaused,
    requestPause: () => handlePause("pause"),
    overlay,
  };
}
