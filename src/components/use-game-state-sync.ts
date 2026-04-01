"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseGameStateSyncArgs<TState> = {
  initialState: TState | null;
  statePath: string;
  startPath?: string;
  startBody?: Record<string, unknown>;
  intervalMs?: number;
  nextRefreshAt?: number | null;
  getNextRefreshAt?: (state: TState | null) => number | null | undefined;
};

export function useGameStateSync<TState>({
  initialState,
  statePath,
  startPath,
  startBody,
  intervalMs = 1200,
  nextRefreshAt,
  getNextRefreshAt,
}: UseGameStateSyncArgs<TState>) {
  const [state, setState] = useState<TState | null>(initialState);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const hasStartedRef = useRef(false);
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
    if (!startPath || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

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
    if (typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource("/api/games/events");

    const handleStateChange = () => {
      if (document.visibilityState === "visible") {
        void refreshState();
      }
    };

    eventSource.addEventListener("ready", () => {
      setIsRealtimeConnected(true);
      void refreshState();
    });
    eventSource.addEventListener("state", handleStateChange);
    eventSource.addEventListener("heartbeat", () => {
      setIsRealtimeConnected(true);
    });
    eventSource.onerror = () => {
      setIsRealtimeConnected(false);
    };

    return () => {
      eventSource.close();
      setIsRealtimeConnected(false);
    };
  }, [refreshState]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void refreshState();
      }
    }

    if (isRealtimeConnected) {
      document.addEventListener("visibilitychange", refreshIfVisible);

      return () => {
        document.removeEventListener("visibilitychange", refreshIfVisible);
      };
    }

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);

    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [intervalMs, isRealtimeConnected, refreshState]);

  const scheduledRefreshAt = getNextRefreshAt ? getNextRefreshAt(state) : nextRefreshAt;

  useEffect(() => {
    if (!scheduledRefreshAt || Number.isNaN(scheduledRefreshAt)) {
      return;
    }

    const delay = Math.max(0, scheduledRefreshAt - Date.now() + 50);

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        void refreshState();
      }
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshState, scheduledRefreshAt]);

  return {
    state,
    setState,
    refreshState,
    isRealtimeConnected,
  };
}
