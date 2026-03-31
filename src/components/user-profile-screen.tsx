"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppSectionHeader } from "@/components/app-section-header";

type UserProfileScreenProps = {
  displayName: string;
  bio: string;
  avatarPath: string | null;
  hasJoinedRoom: boolean;
};

export function UserProfileScreen({
  displayName,
  bio,
  avatarPath,
  hasJoinedRoom,
}: UserProfileScreenProps) {
  const router = useRouter();

  return (
    <div className="profile-screen bg-background text-on-background font-body selection:bg-primary selection:text-on-primary-container">
      <AppSectionHeader
        title="Profil"
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

      <main className="pt-8 pb-32 px-6 max-w-md mx-auto min-h-screen">
        <section className="mb-10">
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-40 transition duration-500" />
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high neon-glow-primary bg-surface-container-highest flex items-center justify-center">
                {avatarPath ? (
                  <Image
                    alt={displayName}
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
      </main>

      <AppBottomNav active="profile" hasJoinedRoom={hasJoinedRoom} />
    </div>
  );
}
