"use client";

import type { ReactNode } from "react";

import { formatRoomCode } from "@/lib/room-code";

type GameHeaderShellProps = {
  roomCode?: string;
  fixed?: boolean;
  maxWidthClassName?: string;
  showRoomLabel?: boolean;
  divider?: boolean;
  children: ReactNode;
};

export function GameHeaderShell({
  roomCode,
  fixed = true,
  maxWidthClassName = "max-w-md",
  showRoomLabel = false,
  divider = false,
  children,
}: GameHeaderShellProps) {
  return (
    <header
      className={`${fixed ? "fixed" : "sticky"} top-0 z-50 w-full mobile-safe-top bg-[#0e0e0e]/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(182,160,255,0.1)]`}
    >
      <div className={`mx-auto w-full ${maxWidthClassName}`}>
        {showRoomLabel && roomCode ? (
          <div className="flex justify-center pb-2 pt-4">
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Pokój {formatRoomCode(roomCode)}
            </span>
          </div>
        ) : null}

        {children}
      </div>

      {divider ? <div className="h-px w-full bg-[#131313] opacity-20" /> : null}
    </header>
  );
}

