"use client";

type GamePauseOverlayProps = {
  isOpen: boolean;
  title: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTertiary?: () => void;
  isBusy?: boolean;
  infoLabel?: string;
};

export function GamePauseOverlay({
  isOpen,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onPrimary,
  onSecondary,
  onTertiary,
  isBusy = false,
  infoLabel,
}: GamePauseOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border border-outline-variant/15 bg-surface-container px-6 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high shadow-[0_0_20px_rgba(182,160,255,0.15)]">
          <span className="material-symbols-outlined text-3xl text-primary">pause_circle</span>
        </div>

        <h2 className="text-center font-headline text-3xl font-black tracking-tight text-on-surface">
          {title}
        </h2>
        <p className="mt-3 text-center text-sm leading-6 text-on-surface-variant">
          {description}
        </p>

        {infoLabel ? (
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
            {infoLabel}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {primaryLabel && onPrimary ? (
            <button
              className="w-full rounded-full bg-gradient-to-r from-primary to-primary-dim px-5 py-4 font-headline text-sm font-bold uppercase tracking-[0.12em] text-on-primary-fixed active:scale-[0.98] disabled:opacity-60"
              type="button"
              onClick={onPrimary}
              disabled={isBusy}
            >
              {primaryLabel}
            </button>
          ) : null}

          {secondaryLabel && onSecondary ? (
            <button
              className="w-full rounded-full border border-outline-variant/20 bg-surface-container-high px-5 py-4 font-headline text-sm font-bold uppercase tracking-[0.12em] text-on-surface active:scale-[0.98] disabled:opacity-60"
              type="button"
              onClick={onSecondary}
              disabled={isBusy}
            >
              {secondaryLabel}
            </button>
          ) : null}

          {tertiaryLabel && onTertiary ? (
            <button
              className="w-full rounded-full bg-transparent px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant active:scale-[0.98] disabled:opacity-60"
              type="button"
              onClick={onTertiary}
              disabled={isBusy}
            >
              {tertiaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
