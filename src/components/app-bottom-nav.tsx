"use client";

import Link from "next/link";

type AppBottomNavProps = {
  active: "games" | "friends" | "profile";
  hasJoinedRoom: boolean;
  compact?: boolean;
};

export function AppBottomNav({ active, hasJoinedRoom, compact = false }: AppBottomNavProps) {
  return (
    <nav
      className={`fixed bottom-0 w-full z-50 rounded-t-[2.5rem] bg-[#0e0e0e]/90 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(182,160,255,0.2)] mobile-safe-bottom ${
        compact ? "border-t border-white/6" : ""
      }`}
    >
      <div
        className={`flex justify-around items-center w-full max-w-md mx-auto ${
          compact ? "h-16 px-6 pb-1" : "h-20 px-8 pb-4"
        }`}
      >
        {hasJoinedRoom ? (
          <Link
            className={`flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 ${
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
            <span className={`font-bold uppercase tracking-widest mt-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>Gry</span>
          </Link>
        ) : (
          <button className="flex flex-col items-center justify-center text-slate-500/50 cursor-not-allowed" disabled>
            <span className="material-symbols-outlined">sports_esports</span>
            <span className={`font-bold uppercase tracking-widest mt-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>Gry</span>
          </button>
        )}

        <Link
          className={`flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 ${
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
          <span className={`font-bold uppercase tracking-widest mt-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>Znajomi</span>
        </Link>

        <Link
          className={`flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 ${
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
          <span className={`font-bold uppercase tracking-widest mt-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>Profil</span>
        </Link>
      </div>
    </nav>
  );
}
