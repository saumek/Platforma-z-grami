"use client";

import type { ReactNode } from "react";

type AppSectionHeaderProps = {
  title: string;
  subtitle?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  maxWidthClassName?: string;
};

export function AppSectionHeader({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  maxWidthClassName = "max-w-md",
}: AppSectionHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full mobile-safe-top bg-[#0e0e0e]/84 shadow-[0_4px_32px_0_rgba(182,160,255,0.08)] backdrop-blur-xl">
      <div className={`relative mx-auto flex h-15 w-full items-center justify-between px-4 sm:px-6 ${maxWidthClassName}`}>
        <div className="flex min-w-10 items-center justify-start">
          {leftSlot ?? <span className="h-5 w-5" />}
        </div>

        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center text-center">
          <h1 className="font-headline text-lg font-bold tracking-tighter text-[#b6a0ff] sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-10 items-center justify-end">
          {rightSlot ?? <span className="h-5 w-5" />}
        </div>
      </div>
    </header>
  );
}
