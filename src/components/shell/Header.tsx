"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Command, Moon, Sun, UserRound, Volume2, VolumeX } from "lucide-react";
import { sfx, primeAudio } from "@/lib/sfx";
import { Logo } from "./Logo";
import { useUI } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { getTheme } from "@/lib/themes";
import { useClientAuth } from "@/lib/auth-client";
import { useHydrated } from "@/lib/hooks";

export const NAV = [
  { href: "/type", label: "type", n: "01" },
  { href: "/practice", label: "practice", n: "02" },
  { href: "/race", label: "race", n: "03" },
  { href: "/stats", label: "stats", n: "04" },
  { href: "/history", label: "history", n: "05" },
  { href: "/profile", label: "profile", n: "06" },
];

export function Header() {
  const pathname = usePathname();
  const openPalette = useUI((s) => s.openPalette);
  const hydrated = useHydrated();
  // saved settings only exist in the browser: render the default until hydrated
  const soundOn = useSettings((s) => s.sound) || !hydrated;
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const auth = useClientAuth();
  const dark = getTheme(theme).dark;

  return (
    <header className="chrome relative z-40 mx-auto flex h-[var(--header-h)] w-full max-w-[1400px] items-center gap-6 px-5 sm:px-8">
      <Logo />
      <nav aria-label="Main" className="no-scrollbar -mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`press relative shrink-0 px-2.5 py-1.5 font-mono text-[0.78rem] lowercase transition-colors ${active ? "text-fg" : "text-sub hover:text-fg"}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mr-1 hidden text-[0.6rem] text-faint lg:inline">{item.n}</span>
              {item.label}
              {active && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute inset-x-2 -bottom-0.5 h-[2px] bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-1.5">
        <button
          onClick={openPalette}
          className="press hidden items-center gap-2 border border-line px-2.5 py-1.5 font-mono text-[0.72rem] text-sub hover:border-faint hover:text-fg sm:flex"
          style={{ borderRadius: "var(--radius)" }}
          aria-label="Open command palette"
        >
          <Command size={12} /> K
        </button>
        <button
          onClick={() => {
            const on = !useSettings.getState().sound;
            set({ sound: on });
            if (on) {
              primeAudio();
              sfx("toggle");
            }
          }}
          className="press grid h-8 w-8 place-items-center text-sub hover:text-fg"
          aria-label={soundOn ? "Mute sounds" : "Turn sounds on"}
          aria-pressed={soundOn}
          title={soundOn ? "Sound on (click to mute)" : "Sound off (click to turn on)"}
        >
          <motion.span key={String(soundOn)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </motion.span>
        </button>
        <button
          onClick={() => set({ theme: dark ? useSettings.getState().lightTheme || "daylight" : useSettings.getState().darkTheme || "graphite", followSystem: false })}
          className="press grid h-8 w-8 place-items-center text-sub hover:text-fg"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          <motion.span key={String(dark)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </motion.span>
        </button>
        {auth.enabled &&
          (auth.signedIn ? (
            <Link href="/profile" className="press grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-line" aria-label="Your profile">
              {auth.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auth.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={15} />
              )}
            </Link>
          ) : (
            <button
              onClick={auth.openSignIn}
              className="press ml-1 border border-line px-3 py-1.5 font-mono text-[0.72rem] text-fg hover:border-accent"
              style={{ borderRadius: "var(--radius)" }}
            >
              sign in
            </button>
          ))}
      </div>
    </header>
  );
}
