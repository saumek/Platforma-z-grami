"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import type { AuthResponse } from "@/types/auth";

type ProfileScreenProps = {
  displayName: string;
  bio: string;
  avatarPath: string | null;
  hasJoinedRoom: boolean;
};

export function ProfileScreen({
  displayName,
  bio,
  avatarPath,
  hasJoinedRoom,
}: ProfileScreenProps) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomError, setRoomError] = useState("");

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  async function handleJoinRoom() {
    setRoomError("");

    if (!roomCode.trim()) {
      setRoomError("Wpisz kod pokoju.");
      return;
    }

    setIsJoiningRoom(true);

    try {
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: roomCode }),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setRoomError(data.message);
        return;
      }

      router.push("/games");
      router.refresh();
    } catch {
      setRoomError("Nie udało się dołączyć do pokoju.");
    } finally {
      setIsJoiningRoom(false);
    }
  }

  return (
    <div className="profile-screen bg-background text-on-background font-body selection:bg-primary selection:text-on-primary-container">
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/80 backdrop-blur-xl shadow-[0_4px_40px_0_rgba(182,160,255,0.1)]">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-md mx-auto">
          <button
            className="text-[#b6a0ff] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
            type="button"
            onClick={() => router.back()}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline font-bold tracking-tighter text-[#b6a0ff] text-xl">
            Profil
          </h1>
          <div className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#b6a0ff] to-[#7e51ff] font-headline">
            Gamely
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-md mx-auto min-h-screen">
        <section className="mb-10">
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500" />
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high neon-glow-primary bg-surface-container-highest flex items-center justify-center">
                {avatarPath ? (
                  <Image
                    alt="Avatar użytkownika"
                    className="w-full h-full object-cover"
                    src={avatarPath}
                    width={128}
                    height={128}
                  />
                ) : (
                  <span
                    className="material-symbols-outlined text-primary text-6xl"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    person
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-background">
                {displayName}
              </h2>
              <button
                className="mt-3 px-8 py-2 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors active:scale-95 border border-outline-variant/20"
                type="button"
                onClick={() => router.push("/profile/edit")}
              >
                Edytuj
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8 p-6 rounded-xl bg-surface-container-low relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <h3 className="font-headline text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">info</span> Bio
          </h3>
          <p className="text-on-surface-variant leading-relaxed text-sm font-body">{bio}</p>
        </section>

        <section className="mb-8 p-6 rounded-xl bg-surface-container relative overflow-hidden">
          <h3 className="font-headline text-sm font-bold text-secondary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">videogame_asset</span> Kod pokoju
          </h3>
          <div className="space-y-4">
            <div className="relative group">
              <input
                className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/50 transition-all outline-none font-body"
                placeholder="Wpisz kod..."
                type="text"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant">
                <span className="material-symbols-outlined">key</span>
              </div>
            </div>
            <button
              className="w-full py-4 bg-gradient-to-r from-secondary-container to-secondary-dim text-on-secondary-container font-bold rounded-lg shadow-lg shadow-secondary/10 hover:shadow-secondary/20 active:scale-[0.98] transition-all font-headline disabled:opacity-70"
              type="button"
              onClick={handleJoinRoom}
              disabled={isJoiningRoom}
            >
              {isJoiningRoom ? "Dołączanie..." : "Dołącz do gry"}
            </button>
            {roomError ? <p className="text-sm text-error">{roomError}</p> : null}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="p-4 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-high transition-colors aspect-square">
            <span className="material-symbols-outlined text-primary mb-2 text-3xl">
              emoji_events
            </span>
            <span className="text-xs font-bold uppercase tracking-tighter font-headline">
              Osiągnięcia
            </span>
          </div>
          <Link
            className="p-4 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-high transition-colors aspect-square"
            href="/friends"
          >
            <span className="material-symbols-outlined text-secondary mb-2 text-3xl">
              group
            </span>
            <span className="text-xs font-bold uppercase tracking-tighter font-headline">
              Znajomi
            </span>
          </Link>
        </div>

        <section className="flex justify-center pt-4">
          <button
            className="flex items-center gap-3 px-10 py-4 rounded-full border border-outline-variant/30 text-error-dim font-bold hover:bg-error-container/10 active:scale-95 transition-all font-headline disabled:opacity-70"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <span className="material-symbols-outlined">logout</span>
            Wyloguj
          </button>
        </section>
      </main>

      <AppBottomNav active="profile" hasJoinedRoom={hasJoinedRoom} />
    </div>
  );
}
