"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useRouterRefreshPolling(intervalMs: number) {
  const router = useRouter();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);

    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [intervalMs, router]);
}

