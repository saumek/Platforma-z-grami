"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppSectionHeader } from "@/components/app-section-header";
import type { AuthResponse } from "@/types/auth";

type ProfileEditScreenProps = {
  displayName: string;
  bio: string;
  avatarPath: string | null;
};

export function ProfileEditScreen({
  displayName,
  bio,
  avatarPath,
}: ProfileEditScreenProps) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [description, setDescription] = useState(bio);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarPath);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      return;
    }

    const localUrl = URL.createObjectURL(avatarFile);
    setPreviewUrl(localUrl);

    return () => URL.revokeObjectURL(localUrl);
  }, [avatarFile]);

  const bioLeft = useMemo(() => 280 - description.length, [description.length]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus({ type: "idle", message: "" });

    const formData = new FormData();
    formData.set("displayName", name);
    formData.set("bio", description);

    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setStatus({ type: "error", message: data.message });
        return;
      }

      setStatus({ type: "success", message: data.message });
      router.push("/profile");
      router.refresh();
    } catch {
      setStatus({
        type: "error",
        message: "Nie udało się zapisać zmian profilu.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="profile-screen app-screen-root bg-background text-on-background font-body selection:bg-primary selection:text-on-primary-container">
      <AppSectionHeader
        title="Edycja"
        leftSlot={
          <button
            className="text-[#b6a0ff] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
            type="button"
            onClick={() => router.push("/profile")}
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

      <main className="app-main-with-nav max-w-md mx-auto min-h-screen px-6 pt-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="p-6 rounded-xl bg-surface-container-low relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="flex flex-col items-center text-center">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-40 transition duration-500" />
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high neon-glow-primary bg-surface-container-highest flex items-center justify-center">
                  {previewUrl ? (
                    <Image
                      alt="Podgląd avatara"
                      className="w-full h-full object-cover"
                      src={previewUrl}
                      width={128}
                      height={128}
                      unoptimized={previewUrl.startsWith("blob:")}
                      priority={!previewUrl.startsWith("blob:")}
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

              <label className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors active:scale-95 border border-outline-variant/20 cursor-pointer">
                <span className="material-symbols-outlined text-base">upload</span>
                Zmień zdjęcie
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </section>

          <section className="p-6 rounded-xl bg-surface-container relative overflow-hidden space-y-5">
            <div className="space-y-2">
              <label className="block font-headline text-sm font-bold text-primary">
                Nazwa użytkownika
              </label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/50 transition-all outline-none font-body"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Wpisz nazwę..."
                maxLength={24}
              />
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-sm font-bold text-secondary">
                Biogram
              </label>
              <textarea
                className="w-full min-h-32 resize-none bg-surface-container-highest border-none rounded-lg px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/50 transition-all outline-none font-body"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Opisz siebie..."
                maxLength={280}
              />
              <p className="text-right text-xs text-on-surface-variant">{bioLeft} znaków</p>
            </div>
          </section>

          {status.type !== "idle" ? (
            <div className="text-center text-sm">
              <p className={status.type === "success" ? "text-secondary" : "text-error"}>
                {status.message}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <button
              className="py-4 rounded-lg bg-surface-container-low text-on-surface font-bold active:scale-[0.98] transition-all font-headline"
              type="button"
              onClick={() => router.push("/profile")}
            >
              Anuluj
            </button>
            <button
              className="py-4 bg-gradient-to-r from-primary to-primary-dim text-on-primary-container font-bold rounded-lg shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-[0.98] transition-all font-headline disabled:opacity-70"
              type="submit"
              disabled={isSaving}
            >
              Zapisz
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
