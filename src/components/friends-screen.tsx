"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppSectionHeader } from "@/components/app-section-header";
import { useRouterRefreshPolling } from "@/components/use-router-refresh-polling";
import { formatRoomCode } from "@/lib/room-code";
import type { AuthResponse } from "@/types/auth";

type Roommate = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  relationship: "friend" | "outgoing_pending" | "incoming_pending" | "none";
};

type FriendItem = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  roomCode: string | null;
  isInCurrentRoom: boolean;
  isActive: boolean;
  activityLabel: string;
};

type FriendsScreenProps = {
  hasJoinedRoom: boolean;
  roommate: Roommate | null;
  friends: FriendItem[];
  onlineCount: number;
};

function Avatar({
  avatarPath,
  alt,
  dimmed = false,
  className = "w-14 h-14 rounded-full",
}: {
  avatarPath: string | null;
  alt: string;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} overflow-hidden ${dimmed ? "grayscale" : ""}`}>
      {avatarPath ? (
        <Image alt={alt} className="w-full h-full object-cover" src={avatarPath} width={56} height={56} />
      ) : (
        <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface-variant">person</span>
        </div>
      )}
    </div>
  );
}

export function FriendsScreen({
  hasJoinedRoom,
  roommate,
  friends,
  onlineCount,
}: FriendsScreenProps) {
  const router = useRouter();
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);
  const [joiningFriendId, setJoiningFriendId] = useState<string | null>(null);
  const [friendActionMessage, setFriendActionMessage] = useState("");
  const [joinError, setJoinError] = useState("");

  useRouterRefreshPolling(5000);

  async function addFriend(friendId: string) {
    setFriendActionMessage("");
    setPendingFriendId(friendId);

    try {
      const response = await fetch("/api/friends/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendId }),
      });

      const data = (await response.json()) as AuthResponse;

      setFriendActionMessage(data.message);

      if (!response.ok) {
        return;
      }

      router.refresh();
    } finally {
      setPendingFriendId(null);
    }
  }

  async function joinFriendRoom(roomCode: string | null, friendId: string) {
    if (!roomCode) {
      return;
    }

    setJoinError("");
    setJoiningFriendId(friendId);

    try {
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: roomCode }),
      });

      const data = (await response.json()) as AuthResponse;

      if (response.ok) {
        router.push("/games");
        router.refresh();
        return;
      }

      setJoinError(data.message);
    } catch {
      setJoinError("Nie udało się dołączyć do pokoju.");
    } finally {
      setJoiningFriendId(null);
    }
  }

  return (
    <div className="app-screen-root bg-background text-on-background">
      <AppSectionHeader
        title="Znajomi"
        leftSlot={
          <button
            className="text-[#b6a0ff] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
            type="button"
            onClick={() => router.back()}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        }
        rightSlot={
          <div className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#b6a0ff] to-[#7e51ff] font-headline">
            Gamely
          </div>
        }
      />

      <main className="app-main-with-nav max-w-md mx-auto space-y-8 px-6 pt-8">
        {roommate ? (
          <section className="p-6 rounded-xl bg-surface-container relative overflow-hidden">
            <div className="flex items-end justify-between mb-4">
              <h3 className="font-headline text-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">meeting_room</span> W POKOJU
              </h3>
              <span className="text-on-surface-variant font-medium text-xs">1 osoba</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-5">
              <Avatar
                avatarPath={roommate.avatarPath}
                alt={roommate.displayName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shadow-2xl border-2 border-surface-container-high neon-glow-primary"
              />
              <div className="flex-1">
                <Link href={`/users/${roommate.id}`} className="block">
                  <h3 className="font-headline text-lg sm:text-xl font-bold tracking-tight mb-2">
                    {roommate.displayName}
                  </h3>
                </Link>
                {roommate.relationship === "friend" ? (
                  <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-surface-variant px-4 sm:px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-outline-variant/20">
                    Znajomy
                  </div>
                ) : roommate.relationship === "outgoing_pending" ? (
                  <div className="inline-flex items-center gap-2 bg-surface-container-highest text-primary px-4 sm:px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                    Zaproszenie wysłane
                  </div>
                ) : roommate.relationship === "incoming_pending" ? (
                  <div className="inline-flex items-center gap-2 bg-surface-container-highest text-secondary px-4 sm:px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-secondary/20">
                    Czeka w powiadomieniach
                  </div>
                ) : (
                  <button
                    className="bg-gradient-to-r from-primary to-primary-dim text-on-primary px-5 sm:px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                    type="button"
                    onClick={() => addFriend(roommate.id)}
                    disabled={pendingFriendId === roommate.id}
                  >
                    {pendingFriendId === roommate.id ? "Dodawanie..." : "Dodaj do znajomych"}
                  </button>
                )}
              </div>
            </div>
            {friendActionMessage ? (
              <p className="mt-4 text-sm text-on-surface-variant">{friendActionMessage}</p>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
            <h2 className="font-headline text-2xl font-extrabold tracking-tighter">Znajomi</h2>
            <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                {onlineCount} Online
              </span>
            </div>
          </div>

          {joinError ? <p className="text-sm text-error">{joinError}</p> : null}

          <div className="grid gap-3">
            {friends.length ? (
              friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/users/${friend.id}`}
                  className="bg-surface-container-low/40 rounded-xl p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors duration-300"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar
                        avatarPath={friend.avatarPath}
                        alt={friend.displayName}
                        dimmed={!friend.isActive}
                      />
                      <div
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background ${
                          friend.isActive ? "bg-secondary" : "bg-outline-variant"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`font-bold text-lg truncate ${
                          friend.isActive ? "text-on-background" : "text-on-surface-variant"
                        }`}
                      >
                        {friend.displayName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${
                            friend.isActive ? "text-secondary" : "text-on-surface-variant"
                          }`}
                        >
                          {friend.activityLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 pl-4">
                    {friend.roomCode ? (
                      <>
                        <span className="text-[10px] font-bold text-on-surface-variant/60 tracking-wider uppercase">
                          Pokój {formatRoomCode(friend.roomCode)}
                        </span>
                        {friend.isInCurrentRoom ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary text-right">
                            Jesteś z nim w pokoju
                          </span>
                        ) : (
                          <button
                            className="bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border border-secondary/30 disabled:opacity-60"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              void joinFriendRoom(friend.roomCode, friend.id);
                            }}
                            disabled={joiningFriendId === friend.id}
                          >
                            {joiningFriendId === friend.id ? "..." : "Dołącz"}
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl bg-surface-container-low/40 p-6 text-center text-sm text-on-surface-variant">
                Nie masz jeszcze znajomych. Gdy ktoś będzie z Tobą w pokoju, możesz dodać go tutaj.
              </div>
            )}
          </div>
        </section>
      </main>

      <AppBottomNav active="friends" hasJoinedRoom={hasJoinedRoom} />
    </div>
  );
}
