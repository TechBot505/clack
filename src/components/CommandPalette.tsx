"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Code2,
  Flame,
  History,
  Keyboard,
  LogIn,
  LogOut,
  Moon,
  Palette,
  Quote,
  RotateCcw,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  Type,
  User,
  Volume2,
  VolumeX,
  Waves,
  Zap,
  Hash,
  Target,
  Swords,
  CalendarDays,
  Home,
  Dumbbell,
  Eye,
} from "lucide-react";
import { useSettings, type CaretStyle, type SoundPack } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { THEMES, getTheme } from "@/lib/themes";
import { useClientAuth } from "@/lib/auth-client";
import type { TestConfig } from "@/engine/types";
import { triggerEasterEgg } from "./EasterEggs";
import { sfx } from "@/lib/sfx";
import { useProgression } from "@/lib/use-progression";

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords?: string[];
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const toggle = useUI((s) => s.togglePalette);
  const paletteKey = useUI((s) => s.paletteKey);

  // Cmd/Ctrl+K anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // The body mounts fresh on every open, so search and sub-page reset naturally.
  return <AnimatePresence>{open && <PaletteBody key={paletteKey} />}</AnimatePresence>;
}

function PaletteBody() {
  const close = useUI((s) => s.closePalette);
  const router = useRouter();
  const auth = useClientAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<"root" | "themes">("root");

  const commands = useMemo<Cmd[]>(() => {
    const s = useSettings.getState;
    const startTest = (patch: Partial<TestConfig>) => () => {
      s().setTest(patch);
      useUI.getState().requestRestart();
      router.push("/type");
    };
    const go = (path: string) => () => router.push(path);
    const list: Cmd[] = [
      { id: "t15", label: "Start 15s test", group: "Test", icon: Timer, keywords: ["time", "fifteen"], run: startTest({ mode: "time", duration: 15 }) },
      { id: "t30", label: "Start 30s test", group: "Test", icon: Timer, keywords: ["time"], run: startTest({ mode: "time", duration: 30 }) },
      { id: "t60", label: "Start 60s test", group: "Test", icon: Timer, keywords: ["time", "minute"], run: startTest({ mode: "time", duration: 60 }) },
      { id: "t120", label: "Start 120s test", group: "Test", icon: Timer, keywords: ["time"], run: startTest({ mode: "time", duration: 120 }) },
      { id: "w10", label: "Words 10", group: "Test", icon: Type, run: startTest({ mode: "words", wordCount: 10 }) },
      { id: "w25", label: "Words 25", group: "Test", icon: Type, run: startTest({ mode: "words", wordCount: 25 }) },
      { id: "w50", label: "Words 50", group: "Test", icon: Type, run: startTest({ mode: "words", wordCount: 50 }) },
      { id: "w100", label: "Words 100", group: "Test", icon: Type, run: startTest({ mode: "words", wordCount: 100 }) },
      { id: "quotes", label: "Quotes", group: "Test", icon: Quote, keywords: ["quote", "book"], run: startTest({ mode: "quote" }) },
      { id: "code", label: "Code mode", group: "Test", icon: Code2, keywords: ["programming", "snippet"], run: startTest({ mode: "code" }) },
      { id: "zen", label: "Zen mode", group: "Test", icon: Waves, keywords: ["free", "calm"], run: startTest({ mode: "zen" }) },
      { id: "flow", label: s().test.flow ? "Flow mode: turn off" : "Flow mode: turn on", group: "Test", icon: Eye, keywords: ["focus", "hide", "stats"], run: startTest({ flow: !s().test.flow }) },
      { id: "punct", label: s().test.punctuation ? "Punctuation: off" : "Punctuation: on", group: "Test", icon: Hash, run: startTest({ punctuation: !s().test.punctuation }) },
      { id: "nums", label: s().test.numbers ? "Numbers: off" : "Numbers: on", group: "Test", icon: Hash, run: startTest({ numbers: !s().test.numbers }) },
      { id: "diff", label: s().test.content === "difficult" ? "Common words" : "Difficult words", group: "Test", icon: Flame, run: startTest({ content: s().test.content === "difficult" ? "common" : "difficult" }) },
      { id: "strict", label: s().test.strict ? "Accuracy mode: off" : "Accuracy mode: on", group: "Test", icon: Target, keywords: ["strict", "stop on error"], run: startTest({ strict: !s().test.strict }) },
      { id: "restart", label: "Restart test", group: "Test", icon: RotateCcw, hint: "tab", run: () => { useUI.getState().requestRestart(); router.push("/type"); } },
      { id: "burst", label: "Speed burst", group: "Test", icon: Zap, keywords: ["drag", "race", "sprint", "experimental"], run: go("/burst") },
      { id: "pace", label: "Consistency challenge", group: "Test", icon: Target, keywords: ["pace", "target", "steady"], run: go("/pace") },
      { id: "focus", label: "Focus mode", group: "Test", icon: Waves, keywords: ["ambient", "fullscreen", "rain", "space"], run: go("/focus") },
      { id: "internet", label: "Type the internet", group: "Test", icon: Sparkles, keywords: ["experimental", "twisters", "json", "urls", "speeches"], run: go("/internet") },
      { id: "custom", label: "Custom test builder", group: "Test", icon: Sparkles, keywords: ["paste", "text", "share"], run: go("/practice#custom") },
      { id: "home", label: "Home", group: "Go to", icon: Home, run: go("/") },
      { id: "type", label: "Type", group: "Go to", icon: Keyboard, run: go("/type") },
      { id: "practice", label: "Practice", group: "Go to", icon: Dumbbell, run: go("/practice") },
      { id: "history", label: "Open history", group: "Go to", icon: History, run: go("/history") },
      { id: "stats", label: "View statistics", group: "Go to", icon: BarChart3, run: go("/stats") },
      { id: "records", label: "Personal records", group: "Go to", icon: Trophy, keywords: ["pb", "best"], run: go("/records") },
      { id: "profile", label: "Open profile", group: "Go to", icon: User, run: go("/profile") },
      { id: "race", label: "Race a friend", group: "Go to", icon: Swords, keywords: ["multiplayer"], run: go("/race") },
      { id: "daily", label: "Daily challenge", group: "Go to", icon: CalendarDays, run: go("/daily") },
      { id: "leaderboard", label: "Leaderboards", group: "Go to", icon: Trophy, keywords: ["rank", "global"], run: go("/leaderboard") },
      { id: "settings", label: "Settings", group: "Go to", icon: Settings, hint: "", run: go("/settings") },
      {
        id: "toggle-theme",
        label: "Toggle dark / light",
        group: "Appearance",
        icon: Moon,
        run: () => {
          const cur = getTheme(s().theme);
          s().set({ theme: cur.dark ? s().lightTheme || "daylight" : s().darkTheme || "graphite", followSystem: false });
        },
      },
      {
        id: "themes",
        label: "Change theme…",
        group: "Appearance",
        icon: Palette,
        run: () => {
          setSearch("");
          setPage("themes");
        },
      },
      ...(["line", "block", "underscore", "glow", "pulse"] as CaretStyle[]).map((c) => ({
        id: `caret-${c}`,
        label: `Caret: ${c}`,
        group: "Appearance",
        icon: Type,
        run: () => s().set({ caretStyle: c }),
      })),
      {
        id: "sound-master",
        label: s().sound ? "Mute all sounds" : "Turn sounds on",
        group: "Sound",
        icon: s().sound ? VolumeX : Volume2,
        keywords: ["audio", "mute", "volume"],
        run: () => {
          const on = !s().sound;
          s().set({ sound: on });
          if (on) sfx("toggle");
        },
      },
      {
        id: "sound-ui",
        label: s().uiSounds ? "Interface sounds: off" : "Interface sounds: on",
        group: "Sound",
        icon: Volume2,
        keywords: ["chime", "results", "finish"],
        run: () => s().set({ uiSounds: !s().uiSounds }),
      },
      ...(["off", "soft", "mechanical", "typewriter", "retro", "digital", "bubble"] as SoundPack[]).map((p) => ({
        id: `sound-${p}`,
        label: p === "off" ? "Keyboard sound: off" : `Keyboard sound: ${p}`,
        group: "Sound",
        icon: Volume2,
        keywords: ["pack", "click", "clack"],
        run: () => {
          s().set({ soundPack: p, ...(p !== "off" ? { sound: true } : {}) });
          if (p !== "off") [0, 90, 170].forEach((d, i) => setTimeout(() => sfx(i === 2 ? "space" : "key"), d));
        },
      })),
      { id: "live", label: s().showLiveWpm ? "Hide live WPM" : "Show live WPM", group: "Appearance", icon: Zap, run: () => s().set({ showLiveWpm: !s().showLiveWpm }) },
      { id: "kb", label: s().showKeyboard ? "Hide on-screen keyboard" : "Show on-screen keyboard", group: "Appearance", icon: Keyboard, run: () => s().set({ showKeyboard: !s().showKeyboard }) },
    ];
    if (auth.enabled) {
      list.push(
        auth.signedIn
          ? { id: "signout", label: "Sign out", group: "Account", icon: LogOut, run: auth.signOut }
          : { id: "signin", label: "Sign in / create account", group: "Account", icon: LogIn, run: auth.openSignIn },
      );
    }
    return list;
  }, [router, auth]);

  const secret = triggerEasterEgg.match(search);
  const groups = Array.from(new Set(commands.map((c) => c.group)));
  const unlocked = useSettings((s) => s.unlockedThemes);
  const prog = useProgression();

  const run = (fn: () => void) => {
    close();
    // let the dialog close before navigation / heavy work
    requestAnimationFrame(fn);
  };

  return (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={close} aria-hidden />
          <motion.div
            role="dialog"
            aria-label="Command palette"
            className="relative w-full max-w-xl overflow-hidden border border-line bg-bg2 shadow-2xl"
            style={{ borderRadius: "calc(var(--radius) + 6px)" }}
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            <Command
              label="Command palette"
              loop
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (page !== "root") setPage("root");
                  else close();
                }
                if (e.key === "Backspace" && !search && page !== "root") setPage("root");
              }}
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <span className="label !text-accent">{page === "themes" ? "theme" : "⌘k"}</span>
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder={page === "themes" ? "Search themes…" : "Type a command or search…"}
                  className="h-14 w-full bg-transparent font-mono text-sm text-fg outline-none placeholder:text-faint"
                />
                <kbd>esc</kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3">
                <Command.Empty className="px-3 py-8 text-center font-mono text-sm text-sub">
                  {secret ? null : "Nothing here. Try “60”, “code” or “theme”."}
                </Command.Empty>
                {secret && (
                  <Command.Group heading="???">
                    <Item icon={Sparkles} label={secret.label} onSelect={() => run(secret.run)} value={search} />
                  </Command.Group>
                )}
                {page === "themes" ? (
                  <Command.Group heading="Themes">
                    {THEMES.filter((t) => (!t.hidden || unlocked.includes(t.id)) && (!t.unlock || prog.can(t.unlock))).map((t) => (
                      <Command.Item
                        key={t.id}
                        value={`${t.name} ${t.tagline}`}
                        onSelect={() => run(() => useSettings.getState().set({ theme: t.id, followSystem: false }))}
                        className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-sub data-[selected=true]:bg-bg3 data-[selected=true]:text-fg"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        <span className="flex overflow-hidden border border-line" style={{ borderRadius: 4 }}>
                          {t.swatch.map((c) => (
                            <span key={c} className="h-4 w-3" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="font-medium text-fg">{t.name}</span>
                        <span className="truncate text-xs text-faint group-data-[selected=true]:text-sub">{t.tagline}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : (
                  groups.map((g) => (
                    <Command.Group key={g} heading={g}>
                      {commands
                        .filter((c) => c.group === g)
                        .map((c) => (
                          <Item key={c.id} icon={c.icon} label={c.label} hint={c.hint} keywords={c.keywords} onSelect={() => (c.id === "themes" ? c.run() : run(c.run))} />
                        ))}
                    </Command.Group>
                  ))
                )}
              </Command.List>
              <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
                <span>
                  <kbd>↑</kbd> <kbd>↓</kbd> navigate · <kbd>↵</kbd> run
                </span>
                <span>clack.</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
  );
}

function Item({
  icon: Icon,
  label,
  hint,
  keywords,
  value,
  onSelect,
}: {
  icon: Cmd["icon"];
  label: string;
  hint?: string;
  keywords?: string[];
  value?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value ?? label}
      keywords={keywords}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-sub transition-colors data-[selected=true]:bg-bg3 data-[selected=true]:text-fg"
      style={{ borderRadius: "var(--radius)" }}
    >
      <Icon size={15} className="shrink-0 opacity-70" />
      <span className="flex-1">{label}</span>
      {hint ? <kbd>{hint}</kbd> : null}
    </Command.Item>
  );
}
