"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { formatRoomCode } from "@/lib/room-code";

type GamesScreenProps = {
  roomCode: string;
  activeUsersCount: number;
  userOne: string;
  userTwo: string;
  userOneWins: number;
  userTwoWins: number;
};

export function GamesScreen({
  roomCode,
  activeUsersCount,
  userOne,
  userTwo,
  userOneWins,
  userTwoWins,
}: GamesScreenProps) {
  const router = useRouter();
  const [roomState, setRoomState] = useState({
    roomCode,
    activeUsersCount,
    userOne,
    userTwo,
    userOneWins,
    userTwoWins,
  });

  useEffect(() => {
    let isCancelled = false;

    async function refreshRoomState() {
      try {
        const response = await fetch("/api/room/current", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          success: boolean;
          roomCode?: string;
          activeUsersCount?: number;
          userOne?: string;
          userTwo?: string;
          userOneWins?: number;
          userTwoWins?: number;
        };

        if (!isCancelled && data.success && data.roomCode) {
          setRoomState({
            roomCode: data.roomCode,
            activeUsersCount: data.activeUsersCount ?? 0,
            userOne: data.userOne ?? "Użytkownik 1",
            userTwo: data.userTwo ?? "Oczekiwanie...",
            userOneWins: data.userOneWins ?? 0,
            userTwoWins: data.userTwoWins ?? 0,
          });
        }
      } catch {
        // Ignore transient polling errors and keep the last known room state.
      }
    }

    const intervalId = window.setInterval(refreshRoomState, 2500);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshRoomState();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="bg-background text-on-background font-body min-h-screen pb-32">
      <header className="sticky top-0 z-50 bg-[#0e0e0e]/80 backdrop-blur-xl w-full flex justify-between items-center px-6 py-4 shadow-[0_10px_30px_-15px_rgba(182,160,255,0.15)]">
        <div className="flex items-center gap-4">
          <button
            className="active:scale-95 duration-200 hover:opacity-80 transition-opacity"
            type="button"
            onClick={() => router.push("/profile")}
          >
            <span className="material-symbols-outlined text-[#b6a0ff] text-2xl">arrow_back</span>
          </button>
          <h1 className="font-headline text-xl font-bold tracking-tighter text-[#b6a0ff]">
            Room {formatRoomCode(roomState.roomCode)}
          </h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-full border border-outline-variant/15">
          <span className="w-2 h-2 rounded-full bg-tertiary-dim shadow-[0_0_8px_#beee00]" />
          <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
            {roomState.activeUsersCount} Active
          </span>
        </div>
      </header>

      <div className="bg-gradient-to-b from-[#131313] to-transparent h-4 w-full" />

      <main className="px-6 space-y-8 max-w-2xl mx-auto">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container-low border-l-2 border-primary">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-on-surface">{roomState.userOne}</span>
              </div>
            </div>
            <div className="mx-4 min-w-14 text-center">
              <span className="font-headline text-sm font-bold tracking-widest text-on-surface-variant">
                {roomState.userOneWins} - {roomState.userTwoWins}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-semibold text-on-surface">{roomState.userTwo}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface flex items-center gap-3">
            Wybierz wyzwanie
            <span
              className="material-symbols-outlined text-secondary"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              bolt
            </span>
          </h2>

          <div className="grid gap-6">
            <div className="group relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-primary/30 transition-all duration-300">
              <div className="aspect-[21/9] w-full relative">
                <Image
                  alt=""
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZQfVVISZKTHt0bcHEpt4tz5s6ZT7tLWIdZNL8NoJ0UZJo0_NgvK441ePM2kLDK9G8pujtL2BHwxLVKHlgnk9cp2X4tGI3PdGKiSH4NVhqMQoVgCnnQKugmwBiJOEv9VIrVIc32PXnfBwnDsWnAPLWFSnCTpWKUnbyfkSdr_iK879J6LLbu3fBlGsnqE-CtFRVbv4-ePAZuAxXD5NsGVw8fkOMcsIaPG6L25uuhgg-AvWTZOkcSUSCvEWpwJSHktSwghtvHmKsjw"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent" />
              </div>
              <div className="p-5 flex justify-between items-end">
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">Statki 5x5</h3>
                  <p className="text-sm text-on-surface-variant">
                    Classic strategic grid warfare
                  </p>
                </div>
                <button
                  className="bg-primary hover:bg-primary-dim text-on-primary p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-primary/20"
                  type="button"
                  onClick={() => router.push("/games/battleships")}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                </button>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-error/30 transition-all duration-300">
              <div className="aspect-[21/9] w-full relative">
                <Image
                  alt=""
                  className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD56AyB3aIvMlnH6zLV_UrRkKAY2Gc7cPEF0SW8L0B5LnLSz1jBana57oryQbDWwlCY7pPKTaLwv9aO4GRn0oiU3XQl-1mWNH7YjvkNylGwp6LFhMcrfjI9JhwLyM3qjjy8wjAmdtZb4J1xMrwwz3kRlsETGDx7aaGmW7pLMLuRrZRKj0ZEKOWPKxezU9wwssvahbYlTl1q9iAyjt7-EMy6zvwd8YW21Y6TR-NouhPTS8Ed3rRmWsI65AeBqDY_JD4n7Bd6qIf5Zg"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent" />
              </div>
              <div className="p-5 flex justify-between items-end">
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">
                    Pytania dla par
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Romantic &amp; fun trivia for two
                  </p>
                </div>
                <button
                  className="bg-error-dim hover:bg-error text-white p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-error/20"
                  type="button"
                  onClick={() => router.push("/games/couple-qa")}
                >
                  <span className="material-symbols-outlined">favorite</span>
                </button>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-tertiary/30 transition-all duration-300">
              <div className="aspect-[21/9] w-full relative">
                <Image
                  alt=""
                  className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgYjcNrDHtU-tKXvxtIWyhEHaCTjFqnHMQmnzors-agr8xIfYS44mmyAeYc0n5khkKFhO_qBnYD6BRhuRpheGMMGRoSn4JUKmwTO8WAkFTc7x-caUFw7UlvE_46_yCEzoZMbSomMkG-CBLUGb1XWr0wb6f9Qx0i2B0jISzHlNwHvdtMZw4znJZfp1rvnwUPIM5OQBnb8VBFvFkTs6rssd2WInyc61zjPFVa54ON0DTAl6GXMUGfBTw3_17sxq60w1Mdcgjh4UhNQ"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent" />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">
                      Quiz naukowy
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      Test your knowledge of the universe
                    </p>
                  </div>
                  <button className="bg-tertiary-container hover:bg-tertiary text-on-tertiary p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-tertiary/20">
                    <span className="material-symbols-outlined">psychology</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-between px-4 py-2 bg-surface/50 rounded-lg border border-outline-variant/20 hover:bg-surface transition-colors cursor-pointer group/select">
                    <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                      Wybierz dziedzinę
                    </span>
                    <span className="material-symbols-outlined text-sm text-[#b6a0ff]">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppBottomNav active="games" hasJoinedRoom />
    </div>
  );
}
