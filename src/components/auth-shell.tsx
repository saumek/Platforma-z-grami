import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  backHref?: string;
  children: ReactNode;
  footer?: ReactNode;
  background?: "login" | "register";
  brand?: "login" | "register";
};

export function AuthShell({
  title,
  subtitle,
  backHref,
  children,
  footer,
  background = "login",
  brand = "login",
}: AuthShellProps) {
  const isLogin = background === "login";

  return (
    <div className="app-screen-root flex flex-col justify-between selection:bg-secondary selection:text-on-secondary">
      <div className="fixed inset-0 -z-10">
        <div
          className={`absolute ${
            isLogin ? "top-[-10%] left-[-20%] w-[80%] h-[60%] bg-primary/10" : "top-[-10%] right-[-20%] w-[80%] h-[40%] bg-primary/10"
          } rounded-full blur-[120px]`}
        />
        <div
          className={`absolute ${
            isLogin ? "bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-secondary/5" : "bottom-[5%] left-[-15%] w-[70%] h-[35%] bg-secondary/10"
          } rounded-full blur-[120px]`}
        />
        {isLogin ? (
          <div className="fixed top-20 right-[-40px] w-64 h-64 opacity-20 pointer-events-none">
            <Image
              alt=""
              className="w-full h-full object-contain rotate-12"
              fetchPriority="high"
              loading="eager"
              priority
              src="/images/auth-orb.png"
              width={512}
              height={512}
            />
          </div>
        ) : null}
      </div>

      {brand === "register" ? (
        <header className="app-auth-header fixed top-0 right-0 left-0 z-50 flex h-16 w-full items-center justify-between bg-[#0e0e0e]/80 px-6 backdrop-blur-xl">
          {backHref ? (
            <Link
              href={backHref}
              className="flex items-center justify-center p-2 text-primary active:scale-95 transition-transform duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
          ) : (
            <div className="w-10" />
          )}
          <span className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#b6a0ff] to-[#7e51ff] font-headline tracking-tighter">
            Gamely
          </span>
          <div className="w-10" />
        </header>
      ) : null}

      <main
        className={`app-auth-main flex-grow flex w-full flex-col ${
          isLogin ? "max-w-md mx-auto px-8" : "relative overflow-x-hidden px-8"
        }`}
      >
        {brand === "login" ? (
          <header className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center shadow-[0_0_30px_rgba(182,160,255,0.3)]">
                <span className="material-symbols-outlined text-on-primary text-3xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                  sports_esports
                </span>
              </div>
              <div className="h-[2px] w-12 bg-outline-variant/30 rounded-full" />
            </div>
            <h1 className="font-headline text-[3.5rem] tracking-tighter leading-none mb-2 text-primary">
              Gamely
            </h1>
            <p className="font-body text-on-surface-variant text-sm tracking-wide opacity-80">{subtitle}</p>
          </header>
        ) : (
          <section className="mb-12 relative">
            {backHref ? null : null}
            <h1 className="font-headline font-extrabold text-5xl tracking-tight leading-[0.9] mb-4 max-w-[320px]">
              {title}
            </h1>
            <p className="font-body text-on-surface-variant text-sm max-w-[240px]">{subtitle}</p>
          </section>
        )}

        {children}
        {footer}
      </main>

      <div className="app-auth-bottom-handle fixed right-0 bottom-0 left-0 h-8 w-full bg-surface">
        <div className="mx-auto mt-4 h-1.5 w-32 rounded-full bg-on-surface-variant/30" />
      </div>
    </div>
  );
}
