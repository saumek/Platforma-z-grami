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
    <div className="min-h-screen flex flex-col justify-between selection:bg-secondary selection:text-on-secondary">
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
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnjOxhjwWdvKrrh-arC-knZRYsaaUYHGm4Pbd_NwBQCXnbCjz-tYaHXyQAtykVC5qSQGSWGH4sId-qxQMH8WlRqE-EQoglDJ1AAxPh8poKZnrndki_gCYmuv89p176J7dswHv0yzwkPyKud6vjmn-g4gC1jADvoq0znawcS4yFlzW7ogyMr5xMx1BS6lY_i7sNWx-ZlK4pzJ8sAFlxO-n0ODnPs_1__IXb4ODUiYLv5igUDncg1T1Wn8Dc_SIsM7zqRtXMHY_enQ"
              width={512}
              height={512}
            />
          </div>
        ) : null}
      </div>

      {brand === "register" ? (
        <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
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
        className={`flex-grow flex flex-col w-full ${
          isLogin ? "px-8 pt-20 pb-12 max-w-md mx-auto" : "pt-24 pb-12 px-8 overflow-x-hidden relative"
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

      <div className="fixed bottom-0 w-full h-8 bg-surface">
        <div className="w-32 h-1.5 bg-on-surface-variant/30 rounded-full mx-auto mt-4" />
      </div>
    </div>
  );
}
