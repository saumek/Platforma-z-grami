"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { GameHeaderShell } from "@/components/game-header-shell";
import { GameReactionDrawer } from "@/components/game-reaction-drawer";
import { useGameStateSync } from "@/components/use-game-state-sync";
import { useGameSessionControls } from "@/components/use-game-session-controls";
import {
  BATTLESHIP_BOARD_SIZE,
  BATTLESHIP_SHIP_LENGTHS,
  type BattleshipCellState,
} from "@/lib/battleships";
import { formatRoomCode } from "@/lib/room-code";
import type { AuthResponse } from "@/types/auth";

type BattleshipStatus = "waiting" | "setup" | "playing" | "finished";

type BattleshipState = {
  roomCode: string;
  status: BattleshipStatus;
  currentUserId: string;
  currentPlayer: {
    id: string;
    name: string;
    avatarPath: string | null;
    ready: boolean;
    score: number;
    wins: number;
  } | null;
  opponent: {
    id: string;
    name: string;
    avatarPath: string | null;
    ready: boolean;
    score: number;
    wins: number;
  } | null;
  readyCount: number;
  boardSize: number;
  shipLengths: number[];
  ownBoard: BattleshipCellState[];
  ownShips: number[][];
  opponentBoard: BattleshipCellState[];
  revealedOpponentShips: number[][];
  isCurrentUserTurn: boolean;
  winnerId: string | null;
  isPaused: boolean;
  pauseRequestedByName: string | null;
  exitRequestedByName: string | null;
  isCurrentUserExitRequester: boolean;
  canRespondToExit: boolean;
  shouldReturnToMenu: boolean;
};

type BattleshipsScreenProps = {
  roomCode: string;
  hasJoinedRoom: boolean;
  initialState: BattleshipState | null;
};

type Placement = number[] | null;

type SetupDisplayData = {
  board: BattleshipCellState[];
  placements: Placement[];
};

function getShipCells(startIndex: number, length: number, orientation: "horizontal" | "vertical") {
  const row = Math.floor(startIndex / BATTLESHIP_BOARD_SIZE);
  const column = startIndex % BATTLESHIP_BOARD_SIZE;

  if (orientation === "horizontal" && column + length > BATTLESHIP_BOARD_SIZE) {
    return null;
  }

  if (orientation === "vertical" && row + length > BATTLESHIP_BOARD_SIZE) {
    return null;
  }

  return Array.from({ length }, (_, offset) =>
    orientation === "horizontal" ? startIndex + offset : startIndex + offset * BATTLESHIP_BOARD_SIZE,
  );
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/30 bg-surface-container-highest">
      {src ? (
        <Image alt={alt} className="w-full h-full object-cover" src={src} width={36} height={36} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
        </div>
      )}
    </div>
  );
}

export function getSetupDisplayData(options: {
  isSetupLocked: boolean;
  localPlacements: Placement[];
  ownBoard: BattleshipCellState[];
  ownShips: number[][];
  shipLengths: number[];
}) {
  const { isSetupLocked, localPlacements, ownBoard, ownShips, shipLengths } = options;

  if (!isSetupLocked) {
    return {
      board: Array.from({ length: BATTLESHIP_BOARD_SIZE * BATTLESHIP_BOARD_SIZE }, (_, index) =>
        localPlacements.some((ship) => ship?.includes(index)) ? "ship" : "empty",
      ) as BattleshipCellState[],
      placements: localPlacements,
    } satisfies SetupDisplayData;
  }

  const nextPlacements: Placement[] = shipLengths.map(() => null);
  const remainingShips = ownShips.map((ship) => [...ship]);

  shipLengths.forEach((length, index) => {
    const shipIndex = remainingShips.findIndex((ship) => ship.length === length);

    if (shipIndex < 0) {
      return;
    }

    nextPlacements[index] = remainingShips[shipIndex]!;
    remainingShips.splice(shipIndex, 1);
  });

  return {
    board: ownBoard,
    placements: nextPlacements,
  } satisfies SetupDisplayData;
}

function BoardCell({
  state,
  onClick,
  disabled = false,
}: {
  state: BattleshipCellState;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const toneClassName =
    state === "ship"
      ? "bg-primary/12 border border-primary/50"
      : state === "hit"
        ? "bg-error/15 border border-error/50 text-error"
        : state === "miss"
          ? "bg-surface-container-high border border-outline-variant/20 text-outline"
          : state === "available"
            ? "bg-surface-container-high border border-outline-variant/10 text-on-surface-variant hover:border-secondary/40 hover:text-secondary"
            : "bg-surface-container-high border border-outline-variant/10 text-on-surface-variant/40";

  return (
    <button
      className={`relative aspect-square w-full min-w-0 rounded-md flex items-center justify-center transition-all active:scale-95 ${toneClassName}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {state === "hit" ? (
        <span className="absolute inset-0 z-10 grid place-items-center text-[20px] font-black leading-none text-error">
          ×
        </span>
      ) : null}
      {state === "miss" ? (
        <span className="block h-2.5 w-2.5 rounded-full bg-outline/80" />
      ) : null}
    </button>
  );
}

function BoardSection({
  title,
  cells,
  onCellClick,
  disabled = false,
  clickableStates,
  compact = false,
}: {
  title: string;
  cells: BattleshipCellState[];
  onCellClick?: (index: number) => void;
  disabled?: boolean;
  clickableStates?: BattleshipCellState[];
  compact?: boolean;
}) {
  return (
    <section className={compact ? "space-y-2" : "space-y-3"}>
      <h2 className={`font-headline font-extrabold tracking-tight ${compact ? "text-lg" : "text-xl"}`}>{title}</h2>
      <div className={`aspect-square w-full bg-surface-container rounded-xl grid grid-cols-5 relative shadow-2xl ${compact ? "p-2.5 gap-1.5" : "p-4 gap-3"}`}>
        <div
          className="absolute inset-0 opacity-10 pointer-events-none rounded-xl"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #484847 1px, transparent 0)",
            backgroundSize: compact ? "18px 18px" : "24px 24px",
          }}
        />
        {cells.map((cell, index) => (
          <BoardCell
            key={`${title}-${index}`}
            state={cell}
            onClick={onCellClick ? () => onCellClick(index) : undefined}
            disabled={
              disabled ||
              !onCellClick ||
              !(clickableStates ?? ["available"]).includes(cell)
            }
          />
        ))}
      </div>
    </section>
  );
}

function ResultScreen({
  won,
  points,
  wins,
  onRematch,
  onBackToMenu,
  rematchPending,
}: {
  won: boolean;
  points: number;
  wins: number;
  onRematch: () => void;
  onBackToMenu: () => void;
  rematchPending: boolean;
}) {
  return (
    <section className="app-screen-root app-main-with-nav-compact relative flex flex-col items-center justify-center overflow-hidden px-6 pt-10">
      <div className="absolute inset-0 result-screen-glow pointer-events-none" />
      <div className={`absolute -top-20 -left-20 w-72 h-72 blur-[100px] rounded-full ${won ? "bg-primary/10" : "bg-error-dim/10"}`} />
      <div className="absolute bottom-24 -right-20 w-72 h-72 bg-secondary/10 blur-[100px] rounded-full" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <div className={`mb-5 inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface-container-high shadow-[0_0_30px_rgba(182,160,255,0.2)] result-bounce-in ${won ? "text-secondary" : "text-error-dim"}`}>
          <span className="material-symbols-outlined text-[4.5rem] sm:text-[5rem]" style={{ fontVariationSettings: '"FILL" 1' }}>
            {won ? "emoji_events" : "close"}
          </span>
        </div>

        <h1
          className={`font-headline font-black text-5xl tracking-tighter uppercase mb-2 result-bounce-in result-delay-1 ${
            won ? "text-white drop-shadow-[0_0_18px_rgba(0,227,253,0.35)]" : "text-white/90 drop-shadow-[0_0_15px_rgba(215,51,87,0.35)]"
          }`}
        >
          {won ? "Zwycięstwo" : "Porażka"}
        </h1>
        <p className="font-body text-on-surface-variant text-sm tracking-wide uppercase font-bold result-fade-up result-delay-2">
          {won ? "Przeciwnik został zatopiony" : "Twoja flota została zatopiona"}
        </p>

        <div className="w-full grid gap-4 my-10 result-fade-up result-delay-2">
          <div className="bg-surface-container-low p-6 rounded-lg flex items-center justify-between">
            <div className="text-left">
              <p className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
                Punkty w rundzie
              </p>
              <p className="font-headline font-extrabold text-2xl text-on-surface">{points}</p>
            </div>
            <span className={`material-symbols-outlined text-4xl ${won ? "text-secondary/70" : "text-error-dim/70"}`}>
              {won ? "military_tech" : "close"}
            </span>
          </div>

          <div className={`bg-surface-container p-5 rounded-lg col-span-2 ${won ? "border-l-2 border-secondary/30" : "border-l-2 border-error-dim/30"}`}>
            <p className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Punkty pokoju
            </p>
            <div className="flex items-end gap-2">
              <p className="font-headline font-extrabold text-2xl text-on-surface">{wins}</p>
              <p className="font-body text-xs text-zinc-500 mb-1">zwycięstw</p>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-4 result-fade-up result-delay-3">
          <button
            className="w-full py-5 bg-gradient-to-r from-primary to-primary-dim text-on-primary-fixed font-headline font-black uppercase tracking-widest rounded-full shadow-[0_8px_30px_rgba(182,160,255,0.3)] active:scale-95 transition-all duration-200 disabled:opacity-60"
            type="button"
            onClick={onRematch}
            disabled={rematchPending}
          >
            {rematchPending ? "Przygotowuję..." : "Spróbuj ponownie"}
          </button>
          <button
            className="w-full py-5 bg-surface-container-high text-on-surface font-headline font-black uppercase tracking-widest rounded-full hover:opacity-80 active:scale-95 transition-all duration-200"
            type="button"
            onClick={onBackToMenu}
          >
            Wróć do menu
          </button>
        </div>

        <div className="mt-12 text-center opacity-40 result-fade-up result-delay-3">
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
            {won
              ? "Każde zwycięstwo buduje przewagę w pokoju"
              : "Przegrana to tylko lekcja przed kolejnym zwycięstwem"}
          </p>
        </div>
      </div>
    </section>
  );
}

export function BattleshipsScreen({
  roomCode,
  hasJoinedRoom,
  initialState,
}: BattleshipsScreenProps) {
  const router = useRouter();
  const { state, setState, refreshState } = useGameStateSync<BattleshipState>({
    initialState,
    statePath: "/api/games/battleships/state",
    intervalMs: 2500,
  });
  const [placements, setPlacements] = useState<Placement[]>(BATTLESHIP_SHIP_LENGTHS.map(() => null));
  const [selectedShipIndex, setSelectedShipIndex] = useState(0);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const placedCells = useMemo(
    () => new Set(placements.flatMap((ship) => ship ?? [])),
    [placements],
  );
  const isSetupLocked = Boolean(state?.currentPlayer?.ready);
  const setupDisplayData = useMemo(
    () =>
      getSetupDisplayData({
        isSetupLocked,
        localPlacements: placements,
        ownBoard: state?.ownBoard ?? [],
        ownShips: state?.ownShips ?? [],
        shipLengths: state?.shipLengths ?? [...BATTLESHIP_SHIP_LENGTHS],
      }),
    [isSetupLocked, placements, state],
  );
  const gameSessionControls = useGameSessionControls({
    gamePath: "battleships",
    state,
    refreshState,
    setStatusMessage,
  });

  function handleCellClick(index: number) {
    if (state?.currentPlayer?.ready) {
      return;
    }

    const existingShipIndex = placements.findIndex((ship) => ship?.includes(index));

    if (existingShipIndex >= 0) {
      setPlacements((current) =>
        current.map((ship, shipIndex) => (shipIndex === existingShipIndex ? null : ship)),
      );
      setSelectedShipIndex(existingShipIndex);
      setStatusMessage("");
      return;
    }

    const targetShipIndex =
      placements[selectedShipIndex] === null
        ? selectedShipIndex
        : placements.findIndex((ship) => ship === null);

    if (targetShipIndex < 0) {
      setStatusMessage("Usuń któryś statek, jeśli chcesz ustawić go od nowa.");
      return;
    }

    const targetLength = state?.shipLengths[targetShipIndex] ?? BATTLESHIP_SHIP_LENGTHS[targetShipIndex]!;
    const nextCells = getShipCells(index, targetLength, orientation);

    if (!nextCells) {
      setStatusMessage("Statek nie mieści się w tym miejscu.");
      return;
    }

    const occupiedWithoutSelected = new Set<number>();

    placements.forEach((ship, shipIndex) => {
      if (!ship || shipIndex === targetShipIndex) {
        return;
      }

      ship.forEach((cell) => occupiedWithoutSelected.add(cell));
    });

    if (nextCells.some((cell) => occupiedWithoutSelected.has(cell))) {
      setStatusMessage("Statki nie mogą nachodzić na siebie.");
      return;
    }

    setPlacements((current) =>
      current.map((ship, shipIndex) => (shipIndex === targetShipIndex ? nextCells : ship)),
    );
    setStatusMessage("");

    const nextEmptyIndex = placements.findIndex(
      (ship, shipIndex) => shipIndex !== targetShipIndex && ship === null,
    );

    if (nextEmptyIndex >= 0) {
      setSelectedShipIndex(nextEmptyIndex);
    }
  }

  async function handleReady() {
    if (placements.some((ship) => ship === null)) {
      setStatusMessage("Najpierw ustaw wszystkie statki.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/games/battleships/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board: placements.filter((ship): ship is number[] => Boolean(ship)),
        }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się zapisać ustawienia statków.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShoot(target: number) {
    setIsShooting(true);

    try {
      const response = await fetch("/api/games/battleships/shoot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      });

      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        await refreshState();
      }
    } catch {
      setStatusMessage("Nie udało się oddać strzału.");
    } finally {
      setIsShooting(false);
    }
  }

  async function handleRematch() {
    setIsRestarting(true);

    try {
      const response = await fetch("/api/games/battleships/restart", {
        method: "POST",
      });
      const data = (await response.json()) as AuthResponse;
      setStatusMessage(data.message);

      if (response.ok) {
        setPlacements(BATTLESHIP_SHIP_LENGTHS.map(() => null));
        setSelectedShipIndex(0);
        setOrientation("horizontal");
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
      await fetch("/api/games/battleships/restart", {
        method: "POST",
      });
    } catch {
      // Ignore restart failure and still allow leaving the screen.
    } finally {
      setIsRestarting(false);
      router.push("/games");
    }
  }

  const setupBoard = isSetupLocked
    ? setupDisplayData.board
    : Array.from({ length: BATTLESHIP_BOARD_SIZE * BATTLESHIP_BOARD_SIZE }, (_, index) =>
        placedCells.has(index) ? "ship" : "empty",
      ) as BattleshipCellState[];
  const statusLabel =
    state?.status === "waiting"
      ? "Czekamy na drugiego użytkownika"
      : state?.status === "setup"
        ? isSetupLocked
          ? "Czekamy na gotowość przeciwnika"
          : "Ustaw swoje statki"
        : state?.status === "finished"
          ? state.winnerId === state.currentPlayer?.id
            ? "Wygrywasz rundę"
            : "Przeciwnik wygrywa rundę"
          : state?.isCurrentUserTurn
            ? "Twój ruch"
            : "Ruch przeciwnika";

  return (
    <div className="game-viewport bg-background text-on-background font-body">
      <GameHeaderShell roomCode={roomCode} fixed={false} maxWidthClassName="max-w-md">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
          <button
            className="active:scale-95 duration-200 hover:opacity-80 transition-opacity"
            type="button"
            onClick={() => router.push("/games")}
          >
            <span className="material-symbols-outlined text-[#b6a0ff] text-2xl">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className="font-headline text-lg font-bold tracking-tighter text-[#b6a0ff] sm:text-xl">
              Statki 5x5
            </h1>
            <span className="text-[10px] font-bold tracking-[0.2em] text-outline-variant uppercase">
              Pokój {formatRoomCode(roomCode)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {gameSessionControls.pauseButtonVisible ? (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-primary shadow-[0_0_14px_rgba(182,160,255,0.18)] active:scale-95"
              type="button"
              onClick={gameSessionControls.requestPause}
              disabled={gameSessionControls.pauseButtonDisabled}
            >
              <span className="material-symbols-outlined text-[20px]">pause</span>
            </button>
          ) : null}
          <Avatar
            src={state?.currentPlayer?.avatarPath ?? null}
            alt={state?.currentPlayer?.name ?? "Użytkownik"}
          />
        </div>
      </div>
      </GameHeaderShell>

      <main className="game-main-viewport-compact max-w-md mx-auto w-full min-h-0 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className={`flex h-full min-h-0 flex-col ${state?.status === "playing" ? "gap-3" : "gap-5"}`}>
        <section className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex-1 bg-surface-container-low p-3 rounded-lg flex flex-col items-center gap-0.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <span className="font-label text-[9px] font-black uppercase tracking-widest text-primary-dim">
              Ja
            </span>
            <span className="font-headline text-2xl font-extrabold text-on-surface">
              {String(state?.currentPlayer?.score ?? 0).padStart(2, "0")}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-outline-variant opacity-30" />
            <span className="font-headline text-xs font-black italic text-outline px-2 py-1">VS</span>
            <div className="w-px h-4 bg-outline-variant opacity-30" />
          </div>
          <div className="flex-1 bg-surface-container-low p-3 rounded-lg flex flex-col items-center gap-0.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-secondary" />
            <span className="font-label text-[9px] font-black uppercase tracking-widest text-secondary-dim">
              Przeciwnik
            </span>
            <span className="font-headline text-2xl font-extrabold text-on-surface">
              {String(state?.opponent?.score ?? 0).padStart(2, "0")}
            </span>
          </div>
        </section>

        <div className="shrink-0 bg-secondary-container/10 border border-secondary/20 rounded-full py-2.5 px-4 flex items-center justify-center gap-3 self-center shadow-[0_0_18px_rgba(0,227,253,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
          </span>
          <span className="font-label text-[11px] font-bold tracking-[0.15em] text-secondary uppercase">
            {statusLabel}
          </span>
        </div>

        {state?.status === "finished" ? (
          <ResultScreen
            won={state.winnerId === state.currentPlayer?.id}
            points={state.currentPlayer?.score ?? 0}
            wins={state.currentPlayer?.wins ?? 0}
            onRematch={handleRematch}
            onBackToMenu={handleBackToMenu}
            rematchPending={isRestarting}
          />
        ) : state?.status === "waiting" || state?.status === "setup" ? (
          <>
            <section className="shrink-0 rounded-xl bg-surface-container p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline text-2xl font-extrabold tracking-tight">
                    Ustawienie statków
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Flota: {BATTLESHIP_SHIP_LENGTHS.join(", ")} pola
                  </p>
                </div>
                <button
                  className="px-4 py-2 rounded-full bg-surface-container-high text-xs font-bold uppercase tracking-widest text-secondary active:scale-95 disabled:opacity-50"
                  type="button"
                  onClick={() =>
                    setOrientation((current) => (current === "horizontal" ? "vertical" : "horizontal"))
                  }
                  disabled={isSetupLocked || state?.status === "waiting"}
                >
                  {orientation === "horizontal" ? "Poziomo" : "Pionowo"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {BATTLESHIP_SHIP_LENGTHS.map((shipLength, index) => {
                  const isPlaced = setupDisplayData.placements[index] !== null;

                  return (
                    <button
                      key={`ship-${shipLength}-${index}`}
                      className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
                        selectedShipIndex === index
                          ? "bg-primary/15 text-primary"
                          : isPlaced
                            ? "bg-surface-container-high text-secondary"
                            : "bg-surface-container-high text-on-surface"
                      }`}
                      type="button"
                      onClick={() => setSelectedShipIndex(index)}
                      disabled={isSetupLocked || state?.status === "waiting"}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                        Statek
                      </span>
                      <span className="font-headline text-xl font-extrabold">{shipLength}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <BoardSection
              title="Twoja plansza"
              cells={setupBoard}
              onCellClick={handleCellClick}
              clickableStates={["empty", "ship"]}
              disabled={isSetupLocked || state?.status === "waiting"}
              compact
            />

            <section className="shrink-0 space-y-2">
              <button
                className="w-full h-12 bg-gradient-to-r from-primary to-primary-dim rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all duration-200 shadow-lg shadow-primary/20 disabled:opacity-60"
                type="button"
                onClick={handleReady}
                disabled={isSaving || isSetupLocked || state?.status === "waiting"}
              >
                <span
                  className="material-symbols-outlined text-on-primary-fixed"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  check_circle
                </span>
                <span className="font-headline font-extrabold text-on-primary-fixed uppercase tracking-wider">
                  {isSetupLocked ? "Gotowe" : isSaving ? "Zapisywanie..." : "Gotowość"}
                </span>
              </button>

              <p className="text-sm text-on-surface-variant">Gotowość: {state?.readyCount ?? 0}/2</p>
              {statusMessage ? <p className="text-sm text-secondary">{statusMessage}</p> : null}
            </section>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <BoardSection
              title={state?.opponent?.name ?? "Przeciwnik"}
              cells={state?.opponentBoard ?? []}
              onCellClick={state?.status === "playing" ? handleShoot : undefined}
              disabled={isShooting || !state?.isCurrentUserTurn}
              compact
            />

            <BoardSection title="Twoja plansza" cells={state?.ownBoard ?? []} compact />

            {statusMessage ? <p className="shrink-0 text-sm text-secondary">{statusMessage}</p> : null}
            </div>
          </>
        )}
        </div>
      </main>

      {gameSessionControls.overlay}
      <GameReactionDrawer />

      <AppBottomNav active="games" hasJoinedRoom={hasJoinedRoom} compact />
    </div>
  );
}
