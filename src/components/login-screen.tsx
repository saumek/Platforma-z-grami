"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AuthResponse, LoginRequest } from "@/types/auth";

const initialState: LoginRequest = {
  email: "",
  password: "",
  room: "",
};

type LoginScreenProps = {
  registered?: boolean;
  prefilledEmail?: string;
};

export function LoginScreen({
  registered = false,
  prefilledEmail = "",
}: LoginScreenProps) {
  const router = useRouter();
  const [form, setForm] = useState<LoginRequest>({
    ...initialState,
    email: prefilledEmail,
  });
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: registered ? "success" : "idle",
    message: registered ? "Konto zostało utworzone. Możesz się teraz zalogować." : "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof LoginRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status.type !== "idle") {
      setStatus({ type: "idle", message: "" });
    }
  }

  function validate() {
    if (!form.email.trim()) return "Wpisz adres e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Wpisz poprawny adres e-mail.";
    if (!form.password) return "Wpisz hasło.";
    return "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validate();
    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }

    setSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as AuthResponse;

      if (response.ok && form.room?.trim()) {
        router.push("/games");
        return;
      }

      if (response.ok && !form.room?.trim()) {
        router.push("/profile");
        return;
      }

      setStatus({
        type: response.ok ? "success" : "error",
        message: data.message,
      });
    } catch {
      setStatus({
        type: "error",
        message: "Nie udało się połączyć z serwerem.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-secondary selection:text-on-secondary">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <main className="flex-grow flex flex-col px-8 pt-20 pb-12 max-w-md mx-auto w-full">
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center shadow-[0_0_30px_rgba(182,160,255,0.3)]">
              <span
                className="material-symbols-outlined text-on-primary text-3xl"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                sports_esports
              </span>
            </div>
            <div className="h-[2px] w-12 bg-outline-variant/30 rounded-full" />
          </div>
          <h1 className="font-headline text-[3.5rem] text-primary tracking-tighter leading-none mb-2">
            Gamely
          </h1>
          <p className="font-body text-on-surface-variant text-sm tracking-wide opacity-80">
            Wkrocz do świata nowej generacji gamingu.
          </p>
        </header>

        <section className="space-y-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="group">
                <label
                  className="block font-label text-[11px] uppercase tracking-[0.2em] text-on-surface-variant mb-2 ml-1"
                  htmlFor="email"
                >
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-secondary transition-colors">
                    <span className="material-symbols-outlined text-xl">alternate_email</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-high border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/50 transition-all duration-300"
                    id="email"
                    placeholder="twoj@email.pl"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                  />
                </div>
              </div>

              <div className="group">
                <label
                  className="block font-label text-[11px] uppercase tracking-[0.2em] text-on-surface-variant mb-2 ml-1"
                  htmlFor="password"
                >
                  Hasło
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-secondary transition-colors">
                    <span className="material-symbols-outlined text-xl">lock</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-high border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/50 transition-all duration-300"
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(event) => handleChange("password", event.target.value)}
                  />
                </div>
              </div>

              <div className="py-4 flex items-center gap-4">
                <div className="h-[1px] flex-grow bg-surface-container-highest" />
                <span className="text-[10px] font-label text-outline uppercase tracking-widest">
                  Opcjonalne
                </span>
                <div className="h-[1px] flex-grow bg-surface-container-highest" />
              </div>

              <div className="group">
                <label
                  className="block font-label text-[11px] uppercase tracking-[0.2em] text-on-surface-variant mb-2 ml-1"
                  htmlFor="room"
                >
                  Numer pokoju
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-tertiary-dim transition-colors">
                    <span className="material-symbols-outlined text-xl">meeting_room</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-high border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-tertiary-dim/50 transition-all duration-300"
                    id="room"
                    placeholder="np. #8842"
                    type="text"
                    value={form.room}
                    onChange={(event) => handleChange("room", event.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              className="w-full bg-gradient-to-r from-primary to-primary-dim text-on-primary-container font-headline font-bold text-lg py-5 rounded-full shadow-[0_10px_30px_rgba(182,160,255,0.4)] active:scale-95 transition-all duration-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-75"
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
            >
              <span>DOŁĄCZ</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>

            {status.type !== "idle" ? (
              <div className="text-center pt-4 text-sm" aria-live="polite">
                <p className={status.type === "success" ? "text-secondary" : "text-error"}>
                  {status.message}
                </p>
              </div>
            ) : null}
          </form>

          <div className="text-center pt-4">
            <p className="font-body text-sm text-on-surface-variant">
              Nie masz konta?{" "}
              <Link
                href="/register"
                className="text-primary font-semibold hover:text-primary-fixed transition-colors block mt-1"
              >
                Zarejestruj się jeżeli nie masz konta
              </Link>
            </p>
          </div>
        </section>

        <footer className="mt-auto pt-12">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col gap-2">
              <span className="material-symbols-outlined text-secondary">bolt</span>
              <span className="text-[10px] font-label text-outline uppercase tracking-wider leading-tight">
                Szybkie
                <br />
                logowanie
              </span>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col gap-2">
              <span className="material-symbols-outlined text-tertiary-dim">security</span>
              <span className="text-[10px] font-label text-outline uppercase tracking-wider leading-tight">
                Bezpieczne
                <br />
                połączenie
              </span>
            </div>
          </div>
        </footer>
      </main>

      <div className="fixed top-20 right-[-40px] w-64 h-64 opacity-20 pointer-events-none">
        <Image
          alt=""
          className="w-full h-full object-contain rotate-12"
          fetchPriority="high"
          loading="eager"
          priority
          src="/images/auth-orb.png"
          width={256}
          height={256}
        />
      </div>
    </div>
  );
}
