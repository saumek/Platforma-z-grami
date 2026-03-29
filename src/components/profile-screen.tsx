"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { formatRoomCode } from "@/lib/room-code";
import type { AuthResponse } from "@/types/auth";

type ProfileScreenProps = {
  displayName: string;
  bio: string;
  avatarPath: string | null;
  currentRoomCode: string | null;
  hasJoinedRoom: boolean;
  notifications: {
    id: string;
    type: "friend_request" | "friend_request_accepted";
    actorName: string;
    actorAvatarPath: string | null;
    friendRequestId: string | null;
    isActionable: boolean;
  }[];
};

function NotificationAvatar({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  return (
    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest">
      {src ? (
        <Image alt={alt} className="h-full w-full object-cover" src={src} width={44} height={44} />
      ) : (
        <span className="material-symbols-outlined text-on-surface-variant">person</span>
      )}
    </div>
  );
}

export function ProfileScreen({
  displayName,
  bio,
  avatarPath,
  currentRoomCode,
  hasJoinedRoom,
  notifications,
}: ProfileScreenProps) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 7000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const unreadNotificationsCount = notifications.length;

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

  async function handleFriendRequestResponse(requestId: string, action: "accept" | "reject") {
    setNotificationError("");
    setBusyNotificationId(requestId);

    try {
      const response = await fetch("/api/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, action }),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setNotificationError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setNotificationError("Nie udało się obsłużyć zaproszenia.");
    } finally {
      setBusyNotificationId(null);
    }
  }

  async function handleDismissNotification(notificationId: string) {
    setNotificationError("");
    setBusyNotificationId(notificationId);

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setNotificationError(data.message);
        return;
      }

      router.refresh();
    } catch {
      setNotificationError("Nie udało się zamknąć powiadomienia.");
    } finally {
      setBusyNotificationId(null);
    }
  }

  return (
    <div className="profile-screen bg-background text-on-background font-body selection:bg-primary selection:text-on-primary-container">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/12 blur-[110px]" />
        <div className="absolute top-[34%] -left-16 h-56 w-56 rounded-full bg-secondary/8 blur-[100px]" />
        <div className="absolute bottom-20 right-[-4rem] h-64 w-64 rounded-full bg-primary-dim/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 w-full z-50 mobile-safe-top bg-[#0e0e0e]/80 backdrop-blur-xl shadow-[0_4px_40px_0_rgba(182,160,255,0.1)]">
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
          <button
            className="relative text-[#b6a0ff] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
            type="button"
            onClick={() => setIsNotificationsOpen((current) => !current)}
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadNotificationsCount ? (
              <span className="absolute -right-2 -top-1 min-w-5 rounded-full bg-secondary px-1.5 py-0.5 text-center text-[10px] font-black text-background shadow-[0_0_12px_rgba(0,227,253,0.45)]">
                {unreadNotificationsCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="pt-8 pb-32 px-6 max-w-md mx-auto min-h-screen space-y-8">
        {isNotificationsOpen ? (
          <section className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-low px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/75">
                  Powiadomienia
                </p>
                <h3 className="mt-1 font-headline text-lg font-black tracking-tight text-on-background">
                  {unreadNotificationsCount ? `${unreadNotificationsCount} nowych` : "Brak nowych"}
                </h3>
              </div>
              <span className="rounded-full bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Dzwonek
              </span>
            </div>

            {notificationError ? (
              <p className="mb-3 text-sm text-error">{notificationError}</p>
            ) : null}

            <div className="space-y-3">
              {notifications.length ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <NotificationAvatar
                        src={notification.actorAvatarPath}
                        alt={notification.actorName}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                          {notification.type === "friend_request"
                            ? "Zaproszenie do znajomych"
                            : "Znajomi"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-on-surface">
                          {notification.type === "friend_request"
                            ? `${notification.actorName} chce dodać Cię do znajomych.`
                            : `${notification.actorName} zaakceptował Twoje zaproszenie.`}
                        </p>
                      </div>
                    </div>

                    {notification.isActionable && notification.friendRequestId ? (
                      <div className="mt-4 flex gap-3">
                        <button
                          className="flex-1 rounded-full bg-gradient-to-r from-primary to-primary-dim px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-on-primary-fixed active:scale-[0.98] disabled:opacity-60"
                          type="button"
                          onClick={() =>
                            handleFriendRequestResponse(notification.friendRequestId!, "accept")
                          }
                          disabled={busyNotificationId === notification.friendRequestId}
                        >
                          Akceptuj
                        </button>
                        <button
                          className="flex-1 rounded-full border border-outline-variant/25 bg-surface-container-high px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface active:scale-[0.98] disabled:opacity-60"
                          type="button"
                          onClick={() =>
                            handleFriendRequestResponse(notification.friendRequestId!, "reject")
                          }
                          disabled={busyNotificationId === notification.friendRequestId}
                        >
                          Odrzuć
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex justify-end">
                        <button
                          className="rounded-full border border-outline-variant/25 bg-surface-container-high px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant active:scale-[0.98] disabled:opacity-60"
                          type="button"
                          onClick={() => handleDismissNotification(notification.id)}
                          disabled={busyNotificationId === notification.id}
                        >
                          Zamknij
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] bg-surface-container px-4 py-5 text-sm text-on-surface-variant">
                  Na razie nie masz żadnych nowych powiadomień.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[2.25rem] bg-surface-container px-6 py-7 shadow-[0_22px_55px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(182,160,255,0.16),transparent_46%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-5">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary/75">
                  Twoje konto
                </p>
                <h2 className="mt-3 max-w-[8ch] font-headline text-[2.75rem] leading-[0.95] font-black tracking-[-0.06em] text-on-background">
                  {displayName}
                </h2>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    <span className={`h-2.5 w-2.5 rounded-full ${hasJoinedRoom ? "bg-secondary shadow-[0_0_10px_rgba(0,227,253,0.55)]" : "bg-outline-variant"}`} />
                    {hasJoinedRoom ? `W pokoju${currentRoomCode ? ` ${formatRoomCode(currentRoomCode)}` : ""}` : "Poza pokojem"}
                  </div>
                </div>
              </div>

              <div className="relative group shrink-0">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-primary via-secondary to-primary rounded-full blur-md opacity-40 transition duration-500 group-hover:opacity-70" />
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-surface-container-high neon-glow-primary bg-surface-container-highest flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
                  {avatarPath ? (
                    <Image
                      alt="Avatar użytkownika"
                      className="w-full h-full object-cover"
                      src={avatarPath}
                      width={112}
                      height={112}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined text-primary text-5xl"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      person
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface-container-highest px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant border border-outline-variant/20 hover:text-primary transition-colors active:scale-95"
              type="button"
              onClick={() => router.push("/profile/edit")}
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edytuj profil
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-sm font-bold text-primary uppercase tracking-[0.2em]">
              O Tobie
            </h3>
            <span className="h-px flex-1 ml-4 bg-outline-variant/30" />
          </div>
          <p className="max-w-[34ch] text-[15px] leading-8 text-on-surface-variant">
            {bio}
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-sm font-bold text-secondary uppercase tracking-[0.2em]">
              Pokój gry
            </h3>
            <span className="h-px flex-1 ml-4 bg-outline-variant/30" />
          </div>

          <div className="space-y-3">
            <div className="relative group">
              <input
                className="w-full bg-surface-container-high border-none rounded-[1.5rem] px-5 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/50 transition-all outline-none font-body"
                placeholder="Wpisz kod pokoju..."
                type="text"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant">
                <span className="material-symbols-outlined">vpn_key</span>
              </div>
            </div>

            <button
              className="w-full py-4 bg-gradient-to-r from-secondary-container to-secondary-dim text-on-secondary-container font-bold rounded-[1.5rem] shadow-lg shadow-secondary/10 hover:shadow-secondary/20 active:scale-[0.98] transition-all font-headline disabled:opacity-70"
              type="button"
              onClick={handleJoinRoom}
              disabled={isJoiningRoom}
            >
              {isJoiningRoom ? "Dołączanie..." : "Dołącz do gry"}
            </button>

            {roomError ? <p className="text-sm text-error">{roomError}</p> : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-sm font-bold text-on-surface uppercase tracking-[0.2em]">
              Szybkie przejścia
            </h3>
            <span className="h-px flex-1 ml-4 bg-outline-variant/30" />
          </div>

          <div className="space-y-3">
            <button
              className="w-full rounded-[1.6rem] bg-surface-container-low px-5 py-5 flex items-center justify-between text-left hover:bg-surface-container-high transition-colors active:scale-[0.99]"
              type="button"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary text-2xl">emoji_events</span>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
                    Rozwój
                  </span>
                  <span className="block mt-1 text-sm font-black uppercase tracking-tight font-headline">
                    Osiągnięcia
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline-variant">arrow_forward</span>
            </button>

            <Link
              className="w-full rounded-[1.6rem] bg-surface-container-low px-5 py-5 flex items-center justify-between text-left hover:bg-surface-container-high transition-colors active:scale-[0.99]"
              href="/friends"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary text-2xl">group</span>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-secondary/80">
                    Relacje
                  </span>
                  <span className="block mt-1 text-sm font-black uppercase tracking-tight font-headline">
                    Znajomi
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline-variant">arrow_forward</span>
            </Link>
          </div>
        </section>

        <section className="pt-2">
          <button
            className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full border border-outline-variant/30 text-error-dim font-bold hover:bg-error-container/10 active:scale-95 transition-all font-headline disabled:opacity-70 bg-surface-container-low/60"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <span className="material-symbols-outlined">logout</span>
            {isLoggingOut ? "Wylogowywanie..." : "Wyloguj"}
          </button>
        </section>
      </main>

      <AppBottomNav active="profile" hasJoinedRoom={hasJoinedRoom} />
    </div>
  );
}
