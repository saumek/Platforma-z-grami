"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UseGameStateSyncArgs<TState> = {
  initialState: TState | null;
  statePath: string;
  startPath?: string;
  startBody?: Record<string, unknown>;
  intervalMs?: number;
};

export function useGameStateSync<TState>({
  initialState,
  statePath,
  startPath,
  startBody,
  intervalMs = 1200,
}: UseGameStateSyncArgs<TState>) {
  const [state, setState] = useState<TState | null>(initialState);
  const serializedStartBody = useMemo(
    () => (startBody ? JSON.stringify(startBody) : undefined),
    [startBody],
  );

  const refreshState = useCallback(async () => {
    const response = await fetch(statePath, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      success: boolean;
      state?: TState;
    };

    if (data.success && data.state) {
      setState(data.state);
    }
  }, [statePath]);

  useEffect(() => {
    if (!startPath) {
      return;
    }

    void fetch(startPath, {
      method: "POST",
      headers: serializedStartBody
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: serializedStartBody,
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          success: boolean;
          state?: TState;
        };

        if (data.success && data.state) {
          setState(data.state);
        }
      })
      .catch(() => {
        // Keep current state if the warm-up request fails.
      });
  }, [serializedStartBody, startPath]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void refreshState();
      }
    }

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);

    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [intervalMs, refreshState]);

  return {
    state,
    setState,
    refreshState,
  };
}

