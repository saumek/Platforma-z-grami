"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { GameHeaderShell } from "@/components/game-header-shell";
import { GameReactionDrawer } from "@/components/game-reaction-drawer";
import { useGameStateSync } from "@/components/use-game-state-sync";
import { useGameSessionControls } from "@/components/use-game-session-controls";
import {
  LUDO_COLORS,
  LUDO_COLOR_LABELS,
  LUDO_COLOR_STYLES,
  type LudoColor,
} from "@/lib/ludo-constants";
import { formatRoomCode } from "@/lib/room-code";
import type { AuthResponse } from "@/types/auth";

type LudoStatus = "waiting" | "color_selection" | "playing" | "finished";

type LudoState = {
  roomCode: string;
  status: LudoStatus;
  currentUserId: string;
  currentPlayer: {
    id: string;
    name: string;
    avatarPath: string | null;
    color: LudoColor | null;
    tokenProgresses: number[];
    finishedTokens: number;
  } | null;
  opponent: {
    id: string;
    name: string;
    avatarPath: string | null;
    color: LudoColor | null;
    tokenProgresses: number[];
    finishedTokens: number;
  } | null;
  availableColors: {
    color: LudoColor;
    label: string;
    isTaken: boolean;
    isSelected: boolean;
  }[];
  currentTurnUserId: string | null;
  diceValue: number | null;
  movableTokenIndexes: number[];
  lastRollValue: number | null;
  lastRollByUserId: string | null;
  lastRollAt: number | null;
  winnerId: string | null;
  isPaused: boolean;
  pausedAt: number | null;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

type LudoScreenProps = {
  roomCode: string;
  hasJoinedRoom: boolean;
  initialState: LudoState | null;
};

const TRACK_COORDS: Array<[number, number]> = [
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
  [4, 4],
  [3, 4],
  [2, 4],
  [1, 4],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [4, 7],
  [4, 8],
  [4, 9],
  [4, 10],
  [5, 10],
  [6, 10],
  [6, 9],
  [6, 8],
  [6, 7],
  [6, 6],
  [7, 6],
  [8, 6],
  [9, 6],
  [10, 6],
  [10, 5],
  [10, 4],
  [9, 4],
  [8, 4],
  [7, 4],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [5, 0],
];

const COLOR_START_INDEX: Record<LudoColor, number> = {
  green: 0,
  yellow: 10,
  blue: 20,
  red: 30,
};

const HOME_COORDS: Record<LudoColor, Array<[number, number]>> = {
  green: [
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
  ],
  yellow: [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
  ],
  blue: [
    [5, 9],
    [5, 8],
    [5, 7],
    [5, 6],
  ],
  red: [
    [9, 5],
    [8, 5],
    [7, 5],
    [6, 5],
  ],
};

const BASE_SLOTS: Record<LudoColor, Array<[number, number]>> = {
  green: [
    [1.5, 1.5],
    [2.5, 1.5],
    [1.5, 2.5],
    [2.5, 2.5],
  ],
  yellow: [
    [8.5, 1.5],
    [9.5, 1.5],
    [8.5, 2.5],
    [9.5, 2.5],
  ],
  blue: [
    [8.5, 8.5],
    [9.5, 8.5],
    [8.5, 9.5],
    [9.5, 9.5],
  ],
  red: [
    [1.5, 8.5],
    [2.5, 8.5],
    [1.5, 9.5],
    [2.5, 9.5],
  ],
};

function Avatar({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  return src ? (
    <Image
      alt={alt}
      className="h-12 w-12 rounded-full object-cover"
      src={src}
      width={48}
      height={48}
    />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
      <span className="material-symbols-outlined text-lg text-on-surface">person</span>
    </div>
  );
}

function DiceFace({
  value,
  isRolling,
  active,
  accentColor,
  onClick,
}: {
  value: number | null;
  isRolling: boolean;
  active: boolean;
  accentColor: string;
  onClick?: () => void;
}) {
  const displayValue = value ?? 1;
  const pipLayouts: Record<number, Array<[string, string]>> = {
    1: [["50%", "50%"]],
    2: [
      ["28%", "28%"],
      ["72%", "72%"],
    ],
    3: [
      ["28%", "28%"],
      ["50%", "50%"],
      ["72%", "72%"],
    ],
    4: [
      ["28%", "28%"],
      ["72%", "28%"],
      ["28%", "72%"],
      ["72%", "72%"],
    ],
    5: [
      ["28%", "28%"],
      ["72%", "28%"],
      ["50%", "50%"],
      ["28%", "72%"],
      ["72%", "72%"],
    ],
    6: [
      ["28%", "24%"],
      ["72%", "24%"],
      ["28%", "50%"],
      ["72%", "50%"],
      ["28%", "76%"],
      ["72%", "76%"],
    ],
  };

  return (
    <button
      className={`relative flex h-16 w-16 items-center justify-center rounded-[1.2rem] border transition-all duration-300 ${
        active
          ? "border-transparent bg-white shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          : "border-white/8 bg-white/6"
      } ${isRolling ? "dice-roll" : ""}`}
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label="Rzut kostką"
    >
      <div
        className="absolute inset-0 rounded-[1.2rem]"
        style={{
          boxShadow: active ? `0 0 24px ${accentColor}55` : "none",
        }}
      />
      {pipLayouts[displayValue]?.map(([left, top], index) => (
        <span
          key={`${left}-${top}-${index}`}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left,
            top,
            backgroundColor: active ? "#111111" : accentColor,
          }}
        />
      ))}
    </button>
  );
}

function getTrackIndex(color: LudoColor, progress: number) {
  return (COLOR_START_INDEX[color] + progress) % TRACK_COORDS.length;
}

function getTokenCoord(color: LudoColor, progress: number, tokenIndex: number) {
  if (progress === -1) {
    return BASE_SLOTS[color][tokenIndex] ?? BASE_SLOTS[color][0]!;
  }

  if (progress >= 0 && progress <= 39) {
    const [row, col] = TRACK_COORDS[getTrackIndex(color, progress)]!;
    return [col + 0.5, row + 0.5] as [number, number];
  }

  const homeCoord = HOME_COORDS[color][progress - 40];

  if (homeCoord) {
    return [homeCoord[1] + 0.5, homeCoord[0] + 0.5] as [number, number];
  }

  return [5.5, 5.5] as [number, number];
}

function BoardCell({
  row,
  col,
}: {
  row: number;
  col: number;
}) {
  const trackIndex = TRACK_COORDS.findIndex(
    ([trackRow, trackCol]) => trackRow === row && trackCol === col,
  );
  const isTrack = trackIndex >= 0;
  const colorLane = LUDO_COLORS.find((color) =>
    HOME_COORDS[color].some(([laneRow, laneCol]) => laneRow === row && laneCol === col),
  );
  const isCenter = row >= 4 && row <= 6 && col >= 4 && col <= 6;

  let background = "bg-transparent";
  let border = "border-transparent";

  if (row <= 3 && col <= 3) {
    background = "bg-[#11281d]";
    border = "border-[#1f5b39]/40";
  } else if (row <= 3 && col >= 7) {
    background = "bg-[#332c12]";
    border = "border-[#665418]/40";
  } else if (row >= 7 && col >= 7) {
    background = "bg-[#132344]";
    border = "border-[#214d9d]/40";
  } else if (row >= 7 && col <= 3) {
    background = "bg-[#3b151d]";
    border = "border-[#7d2833]/40";
  } else if (colorLane) {
    background = {
      green: "bg-[#193824]",
      yellow: "bg-[#3b3212]",
      blue: "bg-[#162a53]",
      red: "bg-[#431923]",
    }[colorLane];
    border = {
      green: "border-[#46d680]/40",
      yellow: "border-[#ffd84a]/40",
      blue: "border-[#4d7dff]/40",
      red: "border-[#ff6674]/40",
    }[colorLane];
  } else if (isTrack) {
    background = "bg-[#171717]";
    border = "border-white/8";
  } else if (isCenter) {
    background = "bg-[#141414]";
    border = "border-white/6";
  }

  const startColor = LUDO_COLORS.find((color) => {
    const [startRow, startCol] = TRACK_COORDS[COLOR_START_INDEX[color]]!;
    return startRow === row && startCol === col;
  });

  return (
    <div
      className={`relative aspect-square rounded-full border ${background} ${border}`}
      style={{
        boxShadow: startColor
          ? `inset 0 0 0 1px ${LUDO_COLOR_STYLES[startColor].accent}`
          : undefined,
      }}
    />
  );
}

function LudoBoard({
  state,
  onMoveToken,
}: {
  state: LudoState;
  onMoveToken: (tokenIndex: number) => void;
}) {
  const tokenNodes = useMemo(() => {
    const players = [
      state.currentPlayer
        ? {
            side: "current" as const,
            color: state.currentPlayer.color,
            tokens: state.currentPlayer.tokenProgresses,
          }
        : null,
      state.opponent
        ? {
            side: "opponent" as const,
            color: state.opponent.color,
            tokens: state.opponent.tokenProgresses,
          }
        : null,
    ].filter(Boolean) as Array<{
      side: "current" | "opponent";
      color: LudoColor | null;
      tokens: number[];
    }>;

    return players.flatMap((player) =>
      player.color
        ? player.tokens.map((progress, tokenIndex) => ({
            key: `${player.side}-${player.color}-${tokenIndex}`,
            side: player.side,
            color: player.color!,
            tokenIndex,
            coord: getTokenCoord(player.color!, progress, tokenIndex),
            isMovable:
              player.side === "current" && state.movableTokenIndexes.includes(tokenIndex),
          }))
        : [],
    );
  }, [state.currentPlayer, state.movableTokenIndexes, state.opponent]);

  return (
    <div className="mx-auto w-full max-w-[34rem]">
      <div className="relative aspect-square w-full overflow-hidden rounded-[2.2rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(182,160,255,0.08),transparent_32%),linear-gradient(180deg,#121212_0%,#0a0a0a_100%)] p-3 shadow-[0_28px_60px_rgba(0,0,0,0.35)] sm:p-4">
        <div className="relative h-full w-full">
          <div className="grid h-full w-full grid-cols-[repeat(11,minmax(0,1fr))] grid-rows-[repeat(11,minmax(0,1fr))] gap-1">
            {Array.from({ length: 121 }, (_, index) => {
              const row = Math.floor(index / 11);
              const col = index % 11;

              return <BoardCell key={`${row}-${col}`} row={row} col={col} />;
            })}
          </div>

          <div className="pointer-events-none absolute inset-[calc(50%-12%)] rotate-45 rounded-[1.2rem] bg-[linear-gradient(135deg,#37d67a_0%,#ffd84a_30%,#4d7dff_65%,#ff5d6c_100%)] opacity-70 blur-[1px]" />

          {tokenNodes.map((token) => {
            const [x, y] = token.coord;
            const palette = LUDO_COLOR_STYLES[token.color];

            return (
              <button
                key={token.key}
                className={`absolute z-10 flex items-center justify-center rounded-full border-2 p-0 transition-all duration-200 appearance-none ${
                  token.isMovable
                    ? "pointer-events-auto scale-100 ring-4 ring-white/12"
                    : "pointer-events-none"
                }`}
                style={{
                  left: `${(x / 11) * 100}%`,
                  top: `${(y / 11) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: "clamp(30px, 7.2vw, 38px)",
                  height: "clamp(30px, 7.2vw, 38px)",
                  minWidth: "30px",
                  minHeight: "30px",
                  aspectRatio: "1 / 1",
                  borderRadius: "9999px",
                  background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${palette.token} 48%, ${palette.surface} 100%)`,
                  borderColor: token.side === "current" ? "#f5f5f5" : "rgba(255,255,255,0.35)",
                  boxShadow: token.isMovable ? `0 0 20px ${palette.glow}` : `0 0 12px ${palette.glow}`,
                }}
                type="button"
                onClick={() => onMoveToken(token.tokenIndex)}
                aria-label={`Pionek ${token.tokenIndex + 1}`}
              >
                <span className="text-[10px] font-black leading-none text-black/70 sm:text-[11px]">
                  {token.tokenIndex + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlayerPanel({
  player,
  isCurrentTurn,
  diceValue,
  isRolling,
  canRoll,
  onRoll,
  compact = false,
}: {
  player: LudoState["currentPlayer"] | LudoState["opponent"];
  isCurrentTurn: boolean;
  diceValue: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll?: () => void;
  compact?: boolean;
}) {
  if (!player) {
    return (
      <div className={`rounded-[1.5rem] border border-white/8 bg-white/5 ${compact ? "p-3" : "p-4"}`}>
        <div className={`${compact ? "h-16" : "h-20"} animate-pulse rounded-[1.2rem] bg-white/5`} />
      </div>
    );
  }

  const palette = player.color ? LUDO_COLOR_STYLES[player.color] : null;

  return (
    <div className={`rounded-[1.5rem] border border-white/8 bg-white/5 backdrop-blur-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex items-center ${compact ? "gap-2.5" : "gap-3"}`}>
          <div className={compact ? "scale-[0.84] origin-left" : ""}>
            <Avatar src={player.avatarPath} alt={player.name} />
          </div>
          <div>
            <p className={`${compact ? "text-[13px]" : "text-sm"} font-semibold text-on-surface leading-tight`}>
              {player.name}
            </p>
            <div className={`flex items-center gap-2 ${compact ? "mt-0.5" : "mt-1"}`}>
              <span
                className={`${compact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full`}
                style={{ backgroundColor: palette?.token ?? "#555555" }}
              />
              <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-[0.16em] text-on-surface-variant`}>
                {player.color ? LUDO_COLOR_LABELS[player.color] : "Bez koloru"}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-[0.16em] text-on-surface-variant`}>
            W domu
          </p>
          <p className={`${compact ? "mt-0.5 text-xl" : "mt-1 text-2xl"} font-headline font-bold text-on-surface`}>
            {player.finishedTokens}/4
          </p>
        </div>
      </div>

      <div className={`flex items-center justify-between rounded-[1.15rem] bg-black/20 ${compact ? "mt-3 px-3 py-2.5" : "mt-4 px-3 py-3"}`}>
        <div>
          <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-[0.16em] text-on-surface-variant`}>
            Kostka
          </p>
          {isCurrentTurn ? (
            <p className={`${compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"} text-on-surface-variant`}>Rzucasz teraz</p>
          ) : null}
        </div>

        <div className={compact ? "scale-[0.82] origin-right" : ""}>
          <DiceFace
            value={diceValue}
            isRolling={isRolling}
            active={canRoll || isCurrentTurn}
            accentColor={palette?.token ?? "#b6a0ff"}
            onClick={canRoll ? onRoll : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function ColorSelectionScreen({
  state,
  onSelectColor,
  isSubmitting,
}: {
  state: LudoState;
  onSelectColor: (color: LudoColor) => void;
  isSubmitting: boolean;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-32 pt-10">
      <section className="rounded-[2.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          Chińczyk
        </p>
        <h1 className="mt-3 font-headline text-4xl font-black tracking-tight text-on-surface">
          Wybierz swój kolor
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-on-surface-variant">
          Każda osoba wybiera inny kolor. Gdy obie strony potwierdzą wybór, plansza ruszy od razu.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {state.availableColors.map((option) => {
          const palette = LUDO_COLOR_STYLES[option.color];
          const disabled = isSubmitting || (option.isTaken && !option.isSelected);

          return (
            <button
              key={option.color}
              className={`rounded-[2rem] border px-5 py-5 text-left transition-all duration-300 ${
                option.isSelected
                  ? "border-white/15 bg-white/10"
                  : disabled
                    ? "border-white/8 bg-white/5 opacity-55"
                    : "border-white/8 bg-white/5 active:scale-[0.99]"
              }`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectColor(option.color)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    className="h-12 w-12 rounded-full border border-white/15"
                    style={{
                      background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${palette.token} 46%, ${palette.surface} 100%)`,
                      boxShadow: `0 0 22px ${palette.glow}`,
                    }}
                  />
                  <div>
                    <p className="font-headline text-2xl font-bold text-on-surface">
                      {option.label}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {option.isSelected
                        ? "To Twój aktualny kolor"
                        : option.isTaken
                          ? "Ten kolor został już zajęty"
                          : "Kliknij, aby grać tym kolorem"}
                    </p>
                  </div>
                </div>

                <span className="material-symbols-outlined text-on-surface-variant">
                  {option.isSelected ? "check_circle" : option.isTaken ? "lock" : "chevron_right"}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <PlayerPanel
          player={state.currentPlayer}
          isCurrentTurn={false}
          diceValue={null}
          isRolling={false}
          canRoll={false}
        />
        <PlayerPanel
          player={state.opponent}
          isCurrentTurn={false}
          diceValue={null}
          isRolling={false}
          canRoll={false}
        />
      </section>
    </main>
  );
}

function ResultScreen({
  state,
  onRematch,
  onBackToMenu,
  isRestarting,
}: {
  state: LudoState;
  onRematch: () => void;
  onBackToMenu: () => void;
  isRestarting: boolean;
}) {
  const won = state.currentPlayer?.id === state.winnerId;
  const winnerColor = won ? state.currentPlayer?.color : state.opponent?.color;
  const palette = winnerColor ? LUDO_COLOR_STYLES[winnerColor] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-8 pb-32 pt-28">
      <div className="rounded-[2.5rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(182,160,255,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-6 py-8">
        <div
          className="result-bounce-in mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white/10"
          style={{
            background: palette
              ? `radial-gradient(circle at center, ${palette.glow} 0%, rgba(0,0,0,0.15) 70%)`
              : "rgba(255,255,255,0.06)",
          }}
        >
          <span className="material-symbols-outlined text-[4.5rem] text-on-surface">
            {won ? "social_leaderboard" : "sports_score"}
          </span>
        </div>

        <h1 className="compat-bounce mt-6 text-center font-headline text-5xl font-black tracking-tight text-on-surface">
          {won ? "Wygrana" : "Przegrana"}
        </h1>
        <p className="mt-4 text-center text-sm leading-6 text-on-surface-variant">
          {won
            ? "Wszystkie Twoje pionki wróciły do domu jako pierwsze."
            : "Tym razem przeciwnik szybciej domknął całą trasę."}
        </p>

        <div className="mt-8 rounded-[1.8rem] bg-black/25 px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Stan końcowy
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant">{state.currentPlayer?.name}</p>
              <p className="font-headline text-3xl font-bold text-on-surface">
                {state.currentPlayer?.finishedTokens ?? 0}/4
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-on-surface-variant">{state.opponent?.name}</p>
              <p className="font-headline text-3xl font-bold text-on-surface">
                {state.opponent?.finishedTokens ?? 0}/4
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <button
            className="w-full rounded-full bg-gradient-to-r from-primary to-primary-dim py-4 font-headline text-sm font-bold uppercase tracking-[0.12em] text-on-primary-fixed disabled:opacity-60"
            type="button"
            onClick={onRematch}
            disabled={isRestarting}
          >
            {isRestarting ? "Przygotowuję..." : "Zagraj ponownie"}
          </button>
          <button
            className="w-full rounded-full bg-surface-container-high py-4 font-headline text-sm font-bold uppercase tracking-[0.12em] text-on-surface"
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

export function LudoScreen({ roomCode, hasJoinedRoom, initialState }: LudoScreenProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { state, setState, refreshState } = useGameStateSync<LudoState>({
    initialState,
    statePath: "/api/games/ludo/state",
    startPath: "/api/games/ludo/start",
    intervalMs: 1200,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const { pauseButtonVisible, pauseButtonDisabled, requestPause, overlay } =
    useGameSessionControls({
      gamePath: "ludo",
      state,
      refreshState,
      setStatusMessage,
    });

  async function submitAndRefresh(
    path: string,
    body?: Record<string, unknown>,
  ) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as AuthResponse & { state?: LudoState };

    setStatusMessage(data.message);

    if (response.ok && data.state) {
      setState(data.state);
      return true;
    }

    if (response.ok) {
      await refreshState();
      return true;
    }

    return false;
  }

  async function handleColorSelect(color: LudoColor) {
    setIsSubmitting(true);

    try {
      await submitAndRefresh("/api/games/ludo/color", { color });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRoll() {
    setIsSubmitting(true);

    try {
      await submitAndRefresh("/api/games/ludo/roll");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMoveToken(tokenIndex: number) {
    setIsSubmitting(true);

    try {
      await submitAndRefresh("/api/games/ludo/move", { tokenIndex });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestart(mode: "rematch" | "menu") {
    setIsRestarting(true);

    try {
      const response = await fetch("/api/games/ludo/restart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok && mode === "menu") {
        router.push("/games");
        router.refresh();
        return;
      }

      if (response.ok) {
        await refreshState();
      }
    } finally {
      setIsRestarting(false);
    }
  }

  const isCurrentTurn = state?.currentTurnUserId === state?.currentPlayer?.id;
  const currentPlayerId = state?.currentPlayer?.id ?? null;
  const opponentId = state?.opponent?.id ?? null;
  const currentRolling =
    Boolean(state?.lastRollAt) &&
    Boolean(currentPlayerId) &&
    state?.lastRollByUserId === currentPlayerId &&
    (state?.lastRollAt ?? 0) + 1100 > now;
  const opponentRolling =
    Boolean(state?.lastRollAt) &&
    Boolean(opponentId) &&
    state?.lastRollByUserId === opponentId &&
    (state?.lastRollAt ?? 0) + 1100 > now;

  const currentDiceValue =
    state?.lastRollByUserId === currentPlayerId ? state.lastRollValue : null;
  const opponentDiceValue =
    state?.lastRollByUserId === opponentId ? state.lastRollValue : null;

  if (!state) {
    return (
      <div className="min-h-screen bg-background text-on-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-14 w-14 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (state.status === "finished") {
    return (
      <>
        <ResultScreen
          state={state}
          onRematch={() => void handleRestart("rematch")}
          onBackToMenu={() => void handleRestart("menu")}
          isRestarting={isRestarting}
        />
        <GameReactionDrawer />
        {overlay}
      </>
    );
  }

  return (
    <div className="game-viewport bg-background text-on-background">
      <GameHeaderShell roomCode={roomCode} fixed={false} maxWidthClassName="max-w-2xl">
        <div className="mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.push("/games")}>
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <div>
              <p className="font-headline text-lg font-black tracking-tight text-on-surface sm:text-xl">
                Chińczyk
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Pokój {formatRoomCode(roomCode)}
              </p>
            </div>
          </div>

          {pauseButtonVisible ? (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 disabled:opacity-50"
              type="button"
              disabled={pauseButtonDisabled}
              onClick={requestPause}
            >
              <span className="material-symbols-outlined text-on-surface">pause</span>
            </button>
          ) : null}
        </div>
      </GameHeaderShell>

      {state.status === "waiting" || state.status === "color_selection" ? (
        <ColorSelectionScreen
          state={state}
          onSelectColor={handleColorSelect}
          isSubmitting={isSubmitting}
        />
      ) : (
        <main className="game-main-viewport-compact mx-auto flex w-full max-w-2xl min-h-0 flex-col px-3 pt-3 sm:px-6 sm:pt-4">
          <section className="shrink-0">
            <PlayerPanel
              player={state.currentPlayer}
              isCurrentTurn={isCurrentTurn}
              diceValue={currentDiceValue}
              isRolling={currentRolling}
              canRoll={Boolean(isCurrentTurn && !state.diceValue && !isSubmitting)}
              onRoll={() => void handleRoll()}
              compact
            />
          </section>

          <section className="mt-3 flex min-h-0 flex-1 items-center justify-center">
            <LudoBoard state={state} onMoveToken={handleMoveToken} />
          </section>

          <section className="mt-3 shrink-0">
            <PlayerPanel
              player={state.opponent}
              isCurrentTurn={!isCurrentTurn}
              diceValue={opponentDiceValue}
              isRolling={opponentRolling}
              canRoll={false}
              compact
            />
          </section>
        </main>
      )}

      {statusMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-6">
          <div className="rounded-full border border-white/8 bg-black/70 px-4 py-2 text-xs text-on-surface-variant backdrop-blur-md">
            {statusMessage}
          </div>
        </div>
      ) : null}

      <AppBottomNav active="games" hasJoinedRoom={hasJoinedRoom} compact />
      <GameReactionDrawer />
      {overlay}
    </div>
  );
}
