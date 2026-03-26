"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AuthResponse, RegisterRequest } from "@/types/auth";

const initialState: RegisterRequest = {
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterRequest>(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof RegisterRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status.type !== "idle") {
      setStatus({ type: "idle", message: "" });
    }
  }

  function validate() {
    if (!form.email.trim()) return "Wpisz adres e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Wpisz poprawny adres e-mail.";
    if (form.password.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
    if (form.password !== form.confirmPassword) return "Hasła muszą być takie same.";
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as AuthResponse;

      if (response.ok) {
        router.push(`/?registered=1&email=${encodeURIComponent(form.email.trim())}`);
        return;
      }

      setStatus({
        type: "error",
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
    <>
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
        <Link
          href="/"
          className="flex items-center justify-center p-2 text-primary active:scale-95 transition-transform duration-200"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#b6a0ff] to-[#7e51ff] font-headline tracking-tighter">
          Gamely
        </span>
        <div className="w-10" />
      </header>

      <main className="min-h-screen flex flex-col pt-24 pb-12 px-8 overflow-x-hidden relative">
        <div className="absolute top-[-10%] right-[-20%] w-[80%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[5%] left-[-15%] w-[70%] h-[35%] bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />

        <section className="mb-12 relative">
          <h1 className="font-headline font-extrabold text-5xl tracking-tight leading-[0.9] mb-4">
            Dołącz do <span className="text-secondary">elity</span>
          </h1>
          <p className="font-body text-on-surface-variant text-sm max-w-[240px]">
            Stwórz konto i zyskaj dostęp do ekskluzywnych turniejów oraz nagród.
          </p>
        </section>

        <form className="flex flex-col gap-6 relative z-10" onSubmit={handleSubmit}>
          <div className="space-y-2 underglow-focus transition-all duration-300 rounded-lg">
            <label
              className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-4"
              htmlFor="email"
            >
              E-mail
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-outline">mail</span>
              <input
                className="w-full bg-surface-container-high border-none rounded-lg h-14 pl-12 pr-4 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
                id="email"
                placeholder="twoj@email.pl"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 underglow-focus transition-all duration-300 rounded-lg">
            <label
              className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-4"
              htmlFor="password"
            >
              Hasło
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-outline">lock</span>
              <input
                className="w-full bg-surface-container-high border-none rounded-lg h-14 pl-12 pr-4 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
                id="password"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
              />
              <button
                className="absolute right-4 text-outline hover:text-secondary"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                <span className="material-symbols-outlined">visibility</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 underglow-focus transition-all duration-300 rounded-lg">
            <label
              className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant ml-4"
              htmlFor="repeat-password"
            >
              Powtórz hasło
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-outline">lock_reset</span>
              <input
                className="w-full bg-surface-container-high border-none rounded-lg h-14 pl-12 pr-4 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
                id="repeat-password"
                placeholder="••••••••"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => handleChange("confirmPassword", event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 pt-4">
            <button
              className="w-full h-16 bg-gradient-to-br from-primary to-primary-dim text-on-primary-fixed font-headline font-extrabold text-lg rounded-full neon-glow-primary active:scale-95 transition-all duration-200 disabled:opacity-75"
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
            >
              Zarejestruj
            </button>
          </div>

          {status.type !== "idle" ? (
            <div className="text-center px-4" aria-live="polite">
              <p className={status.type === "success" ? "text-secondary text-sm" : "text-error text-sm"}>
                {status.message}
              </p>
            </div>
          ) : null}
        </form>

        <div className="mt-8 text-center px-4">
          <p className="text-[10px] font-label text-on-surface-variant leading-relaxed">
            Klikając „Zarejestruj”, akceptujesz nasz <span className="text-primary font-bold">Regulamin</span> oraz{" "}
            <span className="text-primary font-bold">Politykę Prywatności</span>.
          </p>
        </div>

        <div className="mt-auto flex justify-center pt-8">
          <p className="text-sm font-body text-on-surface-variant">
            Masz już konto?{" "}
            <Link href="/" className="text-secondary font-bold">
              Zaloguj się
            </Link>
          </p>
        </div>

        <div className="absolute -right-12 bottom-24 opacity-20 rotate-12 pointer-events-none">
          <div className="w-40 h-56 glass-card rounded-lg border border-outline-variant/15 flex flex-col p-4">
            <div className="w-12 h-12 bg-tertiary/20 rounded-full mb-4 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-tertiary"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                emoji_events
              </span>
            </div>
            <div className="h-2 w-full bg-surface-container-highest rounded-full mb-2" />
            <div className="h-2 w-2/3 bg-surface-container-highest rounded-full" />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 w-full h-8 bg-surface">
        <div className="w-32 h-1.5 bg-on-surface-variant/30 rounded-full mx-auto mt-4" />
      </div>
    </>
  );
}
