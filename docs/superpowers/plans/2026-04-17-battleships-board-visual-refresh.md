# Battleships Board Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wdrożyć nową oprawę planszy statków 5x5 wraz z wygenerowanymi assetami planszy i trzech modeli statków, bez zmiany mechaniki gry.

**Architecture:** Zachowujemy istniejącą logikę gry i strukturę siatki 5x5, a lifting realizujemy przez dodanie lekkich assetów SVG oraz przebudowę warstwy prezentacyjnej w `battleships-screen.tsx`. Żeby ograniczyć ryzyko regresji, wydzielamy mały helper z mapowaniem assetów i orientacji, który da się objąć testem jednostkowym niezależnie od UI.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind utility classes, statyczne assety SVG w `public/`, Vitest/Jest-style test runner używany w `tests/`.

---

### Task 1: Prepare battleship art assets and testable asset contract

**Files:**
- Create: `public/images/battleships/board-ocean-texture.svg`
- Create: `public/images/battleships/ship-2.svg`
- Create: `public/images/battleships/ship-3.svg`
- Create: `src/components/battleships-board-art.ts`
- Test: `tests/battleships-board-art.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  getBattleshipArtForLength,
  getBattleshipCellTone,
} from "@/components/battleships-board-art";

describe("getBattleshipArtForLength", () => {
  it("returns the 3-cell ship asset for the long ship", () => {
    expect(getBattleshipArtForLength(3)).toEqual({
      src: "/images/battleships/ship-3.svg",
      alt: "Statek długości 3",
    });
  });

  it("returns the shared 2-cell ship asset for short ships", () => {
    expect(getBattleshipArtForLength(2)).toEqual({
      src: "/images/battleships/ship-2.svg",
      alt: "Statek długości 2",
    });
  });
});

describe("getBattleshipCellTone", () => {
  it("maps the gameplay states to stable presentation variants", () => {
    expect(getBattleshipCellTone("empty")).toBe("water");
    expect(getBattleshipCellTone("available")).toBe("available");
    expect(getBattleshipCellTone("ship")).toBe("ship");
    expect(getBattleshipCellTone("hit")).toBe("hit");
    expect(getBattleshipCellTone("miss")).toBe("miss");
    expect(getBattleshipCellTone("blocked")).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/battleships-board-art.test.ts`
Expected: FAIL with module not found for `@/components/battleships-board-art`

- [ ] **Step 3: Create the asset contract helper**

```ts
import type { BattleshipCellState } from "@/lib/battleships";

export type BattleshipCellTone =
  | "water"
  | "available"
  | "ship"
  | "hit"
  | "miss"
  | "blocked";

export function getBattleshipArtForLength(length: number) {
  if (length === 3) {
    return {
      src: "/images/battleships/ship-3.svg",
      alt: "Statek długości 3",
    };
  }

  return {
    src: "/images/battleships/ship-2.svg",
    alt: "Statek długości 2",
  };
}

export function getBattleshipCellTone(state: BattleshipCellState): BattleshipCellTone {
  if (state === "empty") return "water";
  if (state === "available") return "available";
  if (state === "ship") return "ship";
  if (state === "hit") return "hit";
  if (state === "miss") return "miss";
  return "blocked";
}
```

- [ ] **Step 4: Create the board and ship SVG assets**

Create `public/images/battleships/board-ocean-texture.svg` as a subtle dark ocean panel:

```svg
<svg width="640" height="640" viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="640" rx="52" fill="url(#bg)" />
  <rect x="10" y="10" width="620" height="620" rx="42" stroke="rgba(145,219,255,0.12)" />
  <path d="M40 170C110 148 178 142 248 162C316 182 384 189 456 173C523 158 573 160 600 172" stroke="rgba(146,220,255,0.08)" stroke-width="10" stroke-linecap="round"/>
  <path d="M36 306C109 282 185 279 254 298C327 318 398 327 472 308C535 292 577 291 604 300" stroke="rgba(146,220,255,0.06)" stroke-width="12" stroke-linecap="round"/>
  <path d="M34 445C100 422 168 418 242 438C322 459 406 470 484 449C540 434 580 433 608 442" stroke="rgba(146,220,255,0.05)" stroke-width="14" stroke-linecap="round"/>
  <defs>
    <linearGradient id="bg" x1="40" y1="32" x2="590" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#173A56"/>
      <stop offset="0.55" stop-color="#122E47"/>
      <stop offset="1" stop-color="#0C2135"/>
    </linearGradient>
  </defs>
</svg>
```

Create `public/images/battleships/ship-2.svg`:

```svg
<svg width="184" height="84" viewBox="0 0 184 84" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <path d="M18 48L34 24H134L164 38L150 58H44L18 48Z" fill="url(#hull)" />
    <path d="M46 27H98L108 12H67L46 27Z" fill="url(#deck)" />
    <rect x="73" y="18" width="20" height="11" rx="4" fill="#D4E1E7" fill-opacity="0.72" />
    <path d="M28 48H154" stroke="#8EA6B5" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" />
  </g>
  <defs>
    <linearGradient id="hull" x1="31" y1="18" x2="145" y2="70" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8E99A6"/>
      <stop offset="0.5" stop-color="#5F6C79"/>
      <stop offset="1" stop-color="#3B4550"/>
    </linearGradient>
    <linearGradient id="deck" x1="49" y1="12" x2="112" y2="31" gradientUnits="userSpaceOnUse">
      <stop stop-color="#A7B6C1"/>
      <stop offset="1" stop-color="#5A6773"/>
    </linearGradient>
    <filter id="shadow" x="0" y="0" width="184" height="84" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#08131D" flood-opacity="0.45"/>
    </filter>
  </defs>
</svg>
```

Create `public/images/battleships/ship-3.svg`:

```svg
<svg width="220" height="84" viewBox="0 0 220 84" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <path d="M18 48L34 24H162L196 38L182 58H44L18 48Z" fill="url(#hull)" />
    <path d="M46 27H126L138 12H67L46 27Z" fill="url(#deck)" />
    <rect x="74" y="18" width="20" height="11" rx="4" fill="#D4E1E7" fill-opacity="0.72" />
    <rect x="103" y="18" width="18" height="11" rx="4" fill="#C4D3DB" fill-opacity="0.64" />
    <path d="M28 48H186" stroke="#8EA6B5" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" />
  </g>
  <defs>
    <linearGradient id="hull" x1="31" y1="18" x2="177" y2="70" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8E99A6"/>
      <stop offset="0.5" stop-color="#5F6C79"/>
      <stop offset="1" stop-color="#3B4550"/>
    </linearGradient>
    <linearGradient id="deck" x1="49" y1="12" x2="142" y2="31" gradientUnits="userSpaceOnUse">
      <stop stop-color="#A7B6C1"/>
      <stop offset="1" stop-color="#5A6773"/>
    </linearGradient>
    <filter id="shadow" x="0" y="0" width="220" height="84" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#08131D" flood-opacity="0.45"/>
    </filter>
  </defs>
</svg>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/battleships-board-art.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/images/battleships/board-ocean-texture.svg \
        public/images/battleships/ship-2.svg \
        public/images/battleships/ship-3.svg \
        src/components/battleships-board-art.ts \
        tests/battleships-board-art.test.ts
git commit -m "feat: add battleships board art assets"
```

### Task 2: Integrate the new board art into setup and gameplay boards

**Files:**
- Modify: `src/components/battleships-screen.tsx`
- Modify: `src/components/battleships-board-art.ts`
- Test: `tests/battleships-board-art.test.ts`

- [ ] **Step 1: Extend the failing test for orientation-safe asset rendering**

```ts
import { getBattleshipImageClassName } from "@/components/battleships-board-art";

describe("getBattleshipImageClassName", () => {
  it("keeps horizontal ships flat and rotates vertical ships by 90 degrees", () => {
    expect(getBattleshipImageClassName("horizontal")).toContain("rotate-0");
    expect(getBattleshipImageClassName("vertical")).toContain("rotate-90");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/battleships-board-art.test.ts`
Expected: FAIL with `getBattleshipImageClassName is not exported`

- [ ] **Step 3: Add the presentation helper for orientation and overlay styles**

```ts
export function getBattleshipImageClassName(orientation: "horizontal" | "vertical") {
  return orientation === "vertical"
    ? "h-auto w-[68%] rotate-90 drop-shadow-[0_10px_18px_rgba(3,10,18,0.45)]"
    : "h-auto w-[68%] rotate-0 drop-shadow-[0_10px_18px_rgba(3,10,18,0.45)]";
}
```

- [ ] **Step 4: Refactor `BoardCell` to render ocean cells, ship art, and hit/miss overlays**

Replace the icon-based rendering in `src/components/battleships-screen.tsx` with:

```tsx
import {
  getBattleshipArtForLength,
  getBattleshipCellTone,
  getBattleshipImageClassName,
} from "@/components/battleships-board-art";

function BoardCell({
  state,
  onClick,
  disabled = false,
  shipLength,
  shipOrientation = "horizontal",
}: {
  state: BattleshipCellState;
  onClick?: () => void;
  disabled?: boolean;
  shipLength?: number | null;
  shipOrientation?: "horizontal" | "vertical";
}) {
  const tone = getBattleshipCellTone(state);
  const shipArt = shipLength ? getBattleshipArtForLength(shipLength) : null;

  const toneClassName =
    tone === "ship"
      ? "border-[rgba(147,219,255,0.2)] bg-[linear-gradient(180deg,rgba(42,79,113,0.92),rgba(19,47,72,0.95))]"
      : tone === "hit"
        ? "border-[rgba(255,120,96,0.28)] bg-[linear-gradient(180deg,rgba(88,40,44,0.95),rgba(42,22,30,0.98))]"
        : tone === "miss"
          ? "border-[rgba(146,220,255,0.12)] bg-[linear-gradient(180deg,rgba(30,60,88,0.88),rgba(16,35,52,0.96))]"
          : tone === "available"
            ? "border-[rgba(120,208,255,0.18)] bg-[linear-gradient(180deg,rgba(41,78,112,0.88),rgba(21,47,72,0.94))]"
            : tone === "blocked"
              ? "border-[rgba(120,148,167,0.08)] bg-[linear-gradient(180deg,rgba(23,42,60,0.88),rgba(14,27,41,0.94))] opacity-60"
              : "border-[rgba(146,220,255,0.08)] bg-[linear-gradient(180deg,rgba(37,72,104,0.9),rgba(18,42,64,0.96))]";

  return (
    <button
      className={`group relative aspect-square w-full min-w-0 overflow-hidden rounded-[0.95rem] border transition-all duration-200 active:scale-[0.97] ${toneClassName}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,242,255,0.08),transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-[18%] top-[14%] h-[1px] rounded-full bg-white/12 blur-[1px]" />

      {shipArt ? (
        <div className="relative z-10 flex h-full items-center justify-center">
          <Image
            alt={shipArt.alt}
            className={getBattleshipImageClassName(shipOrientation)}
            src={shipArt.src}
            width={184}
            height={84}
          />
        </div>
      ) : null}

      {tone === "hit" ? <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,124,96,0.26),transparent_62%)]" /> : null}
      {tone === "hit" ? <span className="absolute inset-0 flex items-center justify-center text-[20px] text-[#ff9c8c]">✕</span> : null}
      {tone === "miss" ? <span className="absolute inset-0 flex items-center justify-center text-[18px] text-[#98dfff]">•</span> : null}
    </button>
  );
}
```

- [ ] **Step 5: Pass ship metadata into board cells and upgrade the board shell**

Inside `BoardSection`, pass ship metadata computed from the known ship placement arrays instead of relying on plain cell state:

```tsx
type ShipPlacementInfo = {
  length: number;
  orientation: "horizontal" | "vertical";
};

type BoardSectionProps = {
  title: string;
  cells: BattleshipCellState[];
  shipMap?: Record<number, ShipPlacementInfo>;
  onCellClick?: (index: number) => void;
  disabled?: boolean;
  clickableStates?: BattleshipCellState[];
  compact?: boolean;
};

<div className={`relative aspect-square w-full overflow-hidden rounded-[1.4rem] border border-[rgba(146,220,255,0.1)] bg-[#10273c] shadow-[0_30px_80px_rgba(0,0,0,0.32)] ${compact ? "p-2.5 gap-1.5" : "p-4 gap-3"}`}>
  <Image
    alt=""
    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
    src="/images/battleships/board-ocean-texture.svg"
    fill
  />
  <div className="absolute inset-0 rounded-[1.4rem] ring-1 ring-inset ring-white/6" />
  <div className={`relative z-10 grid h-full w-full grid-cols-5 ${compact ? "gap-1.5" : "gap-3"}`}>
    {cells.map((cell, index) => (
      <BoardCell
        key={`${title}-${index}`}
        state={cell}
        shipLength={shipMap?.[index]?.length ?? null}
        shipOrientation={shipMap?.[index]?.orientation ?? "horizontal"}
        onClick={onCellClick ? () => onCellClick(index) : undefined}
        disabled={disabled || !onCellClick || !(clickableStates ?? ["available"]).includes(cell)}
      />
    ))}
  </div>
</div>
```

Build `shipMap` in `BattleshipsScreen` for setup and own board:

```ts
function buildShipMap(ships: Array<number[] | null>): Record<number, ShipPlacementInfo> {
  return ships.reduce<Record<number, ShipPlacementInfo>>((acc, ship) => {
    if (!ship || ship.length === 0) return acc;

    const orientation = ship.length > 1 && ship[1] - ship[0] === BATTLESHIP_BOARD_SIZE ? "vertical" : "horizontal";

    ship.forEach((cell) => {
      acc[cell] = { length: ship.length, orientation };
    });

    return acc;
  }, {});
}
```

- [ ] **Step 6: Update the ship selection cards to render the same fleet art**

Replace the numeric-only preview in the setup cards with a stacked label + thumbnail:

```tsx
const shipArt = getBattleshipArtForLength(shipLength);

<button ...>
  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">Statek</span>
  <div className="mt-2 flex items-center justify-between gap-3">
    <span className="font-headline text-xl font-extrabold">{shipLength}</span>
    <Image alt={shipArt.alt} className="h-auto w-16" src={shipArt.src} width={184} height={84} />
  </div>
</button>
```

- [ ] **Step 7: Run the focused test suite**

Run: `npm test -- tests/battleships-board-art.test.ts tests/battleships.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/battleships-screen.tsx \
        src/components/battleships-board-art.ts \
        tests/battleships-board-art.test.ts
git commit -m "feat: refresh battleships board visuals"
```

### Task 3: Verify mobile fit, state clarity, and no gameplay regressions

**Files:**
- Modify: `src/components/battleships-screen.tsx` (only if verification exposes layout issues)
- Test: `tests/battleships-board-art.test.ts`
- Test: `tests/battleships.test.ts`

- [ ] **Step 1: Run the existing gameplay tests before manual QA**

Run: `npm test -- tests/battleships.test.ts`
Expected: PASS

- [ ] **Step 2: Start the local app and verify the setup screen manually**

Run: `npm run dev`
Expected: Next.js dev server starts on `http://localhost:3000`

Manual checklist in `/games/battleships`:

```txt
1. Open the setup screen on a narrow mobile viewport.
2. Place the 3-cell ship horizontally.
3. Toggle orientation and place both 2-cell ships vertically.
4. Remove one ship and place it again.
5. Confirm the selection cards still indicate which ship is selected and which are already placed.
```

- [ ] **Step 3: Verify the in-game board states manually**

Manual checklist:

```txt
1. Start a game with two clients or two sessions.
2. Confirm own board shows ship art only on occupied cells.
3. Confirm opponent board does not reveal ships before the end of the match.
4. Fire one miss and one hit.
5. Confirm miss marker is cool-toned and hit marker is clearly warmer and stronger.
6. Confirm tap targets still feel responsive on mobile.
```

- [ ] **Step 4: Fix only the layout issues found during QA**

If the board feels cramped, apply a minimal spacing correction in `src/components/battleships-screen.tsx`:

```tsx
<div className={`relative z-10 grid h-full w-full grid-cols-5 ${compact ? "gap-1.5 sm:gap-2" : "gap-3"}`}>
```

If the ship art clips vertically after rotation, reduce the art width:

```ts
export function getBattleshipImageClassName(orientation: "horizontal" | "vertical") {
  return orientation === "vertical"
    ? "h-auto w-[58%] rotate-90 drop-shadow-[0_10px_18px_rgba(3,10,18,0.45)]"
    : "h-auto w-[68%] rotate-0 drop-shadow-[0_10px_18px_rgba(3,10,18,0.45)]";
}
```

- [ ] **Step 5: Re-run tests after any QA fix**

Run: `npm test -- tests/battleships-board-art.test.ts tests/battleships.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/battleships-screen.tsx \
        src/components/battleships-board-art.ts \
        tests/battleships-board-art.test.ts
git commit -m "fix: polish battleships board mobile layout"
```
