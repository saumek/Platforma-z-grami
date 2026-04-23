"use client";

import Link from "next/link";

type AppBottomNavProps = {
  active: "games" | "friends" | "profile";
  hasJoinedRoom: boolean;
  compact?: boolean;
};

export function AppBottomNav({ active, hasJoinedRoom }: AppBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-[1.65rem] border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(29,29,34,0.82)_0%,rgba(12,12,15,0.76)_100%)] backdrop-blur-[26px] shadow-[0_-12px_34px_-20px_rgba(182,160,255,0.24),0_-2px_0_rgba(255,255,255,0.04)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.55)" }}
    >
      <div className="mx-auto flex h-[3.45rem] w-full max-w-md items-center justify-around px-7 pb-0.5">
        {hasJoinedRoom ? (
          <Link
            className={`flex flex-col items-center justify-center transition-colors duration-200 active:scale-90 ${
              active === "games"
                ? "text-[#b6a0ff] drop-shadow-[0_0_8px_rgba(182,160,255,0.5)]"
                : "text-slate-500 hover:text-[#b6a0ff]"
            }`}
            href="/games"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: active === "games" ? '"FILL" 1' : undefined }}
            >
              sports_esports
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest">Gry</span>
          </Link>
        ) : (
          <button className="flex cursor-not-allowed flex-col items-center justify-center text-slate-500/50" disabled type="button">
            <span className="material-symbols-outlined">sports_esports</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest">Gry</span>
          </button>
        )}

        <Link
          className={`flex flex-col items-center justify-center transition-colors duration-200 active:scale-90 ${
            active === "friends"
              ? "text-[#00ffff] drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]"
              : "text-slate-500 hover:text-[#00ffff]"
          }`}
          href="/friends"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: active === "friends" ? '"FILL" 1' : undefined }}
          >
            group
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest">Znajomi</span>
        </Link>

        <Link
          className={`flex flex-col items-center justify-center transition-colors duration-200 active:scale-90 ${
            active === "profile"
              ? "text-[#b6a0ff] drop-shadow-[0_0_8px_rgba(182,160,255,0.5)]"
              : "text-slate-500 hover:text-[#b6a0ff]"
          }`}
          href="/profile"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: active === "profile" ? '"FILL" 1' : undefined }}
          >
            person
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest">Profil</span>
        </Link>
      </div>
    </nav>
  );
}
