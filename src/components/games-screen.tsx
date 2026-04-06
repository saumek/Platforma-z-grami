"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppSectionHeader } from "@/components/app-section-header";
import { formatRoomCode } from "@/lib/room-code";
import {
  SCIENCE_QUIZ_CATEGORIES,
  SCIENCE_QUIZ_CATEGORY_LABELS,
  type ScienceQuizCategory,
} from "@/lib/science-quiz-categories";

type GamesScreenProps = {
  roomCode: string;
  activeUsersCount: number;
  users: Array<{
    id: string;
    name: string;
    points: number;
  }>;
};

export function GamesScreen({
  roomCode,
  activeUsersCount,
  users,
}: GamesScreenProps) {
  const router = useRouter();
  const [roomState, setRoomState] = useState({
    roomCode,
    activeUsersCount,
    users,
  });
  const [scienceCategory, setScienceCategory] = useState<ScienceQuizCategory>("matma");

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
          users?: Array<{
            id: string;
            name: string;
            points: number;
          }>;
        };

        if (!isCancelled && data.success && data.roomCode) {
          setRoomState({
            roomCode: data.roomCode,
            activeUsersCount: data.activeUsersCount ?? 0,
            users: data.users ?? [],
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
    <div className="app-screen-root bg-background text-on-background font-body">
      <AppSectionHeader
        title="Gry"
        subtitle={`Pokój ${formatRoomCode(roomState.roomCode)}`}
        maxWidthClassName="max-w-2xl"
        leftSlot={
          <button
            className="active:scale-95 duration-200 hover:opacity-80 transition-opacity"
            type="button"
            onClick={() => router.push("/profile")}
          >
            <span className="material-symbols-outlined text-[#b6a0ff] text-2xl">arrow_back</span>
          </button>
        }
        rightSlot={
          <div className="flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-high px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-tertiary-dim shadow-[0_0_8px_#beee00]" />
            <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
              {roomState.activeUsersCount} Active
            </span>
          </div>
        }
      />

      <div className="bg-gradient-to-b from-[#131313] to-transparent h-4 w-full" />

      <main className="app-main-with-nav mx-auto max-w-2xl space-y-8 px-6">
        <section className="flex flex-col gap-3">
          <div className="rounded-lg border-l-2 border-primary bg-surface-container-low p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {roomState.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-xl bg-surface-container-high/60 px-3 py-2"
                >
                  <span className="text-sm font-semibold text-on-surface">{user.name}</span>
                  <span className="font-headline text-sm font-bold tracking-widest text-on-surface-variant">
                    {user.points}
                  </span>
                </div>
              ))}
            </div>
            {roomState.users.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Brak aktywnych osób w pokoju.</p>
            ) : null}
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
                  <button
                    className="bg-tertiary-container hover:bg-tertiary text-on-tertiary p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-tertiary/20"
                    type="button"
                    onClick={() => router.push(`/games/science-quiz/${scienceCategory}`)}
                  >
                    <span className="material-symbols-outlined">psychology</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-outline-variant/20 bg-surface/50 transition-colors hover:bg-surface">
                    <select
                      className="w-full bg-transparent px-4 py-2 text-xs font-label uppercase tracking-widest text-on-surface-variant outline-none"
                      value={scienceCategory}
                      onChange={(event) =>
                        setScienceCategory(event.target.value as ScienceQuizCategory)
                      }
                    >
                      {SCIENCE_QUIZ_CATEGORIES.map((category) => (
                        <option key={category} value={category} className="bg-surface-container-low text-on-surface">
                          {SCIENCE_QUIZ_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-primary/30 transition-all duration-300">
              <div className="aspect-[21/9] w-full relative">
                <Image
                  alt=""
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBL1MatwHeEOX7F1Ng-KbU3PQNDJ9blXcP69tqUgyrgk-R8pdVX8pMUOLWd7ATq-mMqZMZbqSX9Pc38p2dav1oLG8REYzvxbn7amesPCvzINflTAE8X5Cj6olqLF0cnfZGrGXEVLhxhg2V_kfWiZQMq49LCMSCZ1xlce-7ZnGqL1SCCVW54nULzkDMcJ1sZS_73F4hhCJQW2Um-SkSkGsAjfdO-5_I2IhJ7NcryVKc3ldQgjYBcPR5pSyBCRQ7GVwcyT1LMkbM3Iw"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent" />
              </div>
              <div className="p-5 flex justify-between items-end">
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">Chińczyk</h3>
                  <p className="text-sm text-on-surface-variant">Classic ludo game for two</p>
                </div>
                <button
                  aria-label="Chińczyk"
                  className="bg-primary hover:bg-primary-dim text-on-primary p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-primary/20"
                  title="Chińczyk"
                  type="button"
                  onClick={() => router.push("/games/ludo")}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                </button>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-secondary/30 transition-all duration-300">
              <div className="aspect-[21/9] w-full relative">
                <Image
                  alt=""
                  className="w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-500"
                  src="/images/game-dopowiedzenia.png"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent" />
              </div>
              <div className="p-5 flex justify-between items-end">
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">Dopowiedzenia</h3>
                  <p className="text-sm text-on-surface-variant">Twórz śmieszne historie</p>
                </div>
                <button
                  aria-label="Dopowiedzenia"
                  className="bg-primary hover:bg-primary-dim text-on-primary p-3 rounded-full active:scale-90 duration-200 shadow-lg shadow-primary/20"
                  title="Dopowiedzenia"
                  type="button"
                  onClick={() => router.push("/games/dopowiedzenia")}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppBottomNav active="games" hasJoinedRoom />
    </div>
  );
}
