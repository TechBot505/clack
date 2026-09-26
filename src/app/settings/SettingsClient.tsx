"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Trash2 } from "lucide-react";
import { PageHeader, PageShell, Segmented } from "@/components/ui/primitives";
import { Select, SettingRow, Slider, Switch } from "@/components/ui/controls";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useSettings, type CaretStyle, type KeyboardLayout, type MotionPref, type QuickRestart, type SoundPack, type TypeFont } from "@/stores/settings";
import { THEMES } from "@/lib/themes";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { playSound, primeAudio } from "@/lib/sound";
import { useHistory } from "@/stores/history";
import { useClientAuth } from "@/lib/auth-client";
import { useUI } from "@/stores/ui";
import { LANGUAGES } from "@/content/languages";

const SECTIONS = ["appearance", "typing", "behavior", "sound", "accessibility", "privacy", "account"] as const;

const FONTS: { id: TypeFont; label: string }[] = [
  { id: "jetbrains", label: "JetBrains Mono" },
  { id: "geist-mono", label: "Geist Mono" },
  { id: "fira-code", label: "Fira Code" },
  { id: "ibm-plex", label: "IBM Plex Mono" },
  { id: "space-mono", label: "Space Mono" },
  { id: "bricolage", label: "Bricolage (sans)" },
  { id: "fraunces", label: "Fraunces (serif)" },
];

export function SettingsClient() {
  const s = useSettings();
  const set = s.set;
  const [active, setActive] = useState<(typeof SECTIONS)[number]>("appearance");
  const [nonce, setNonce] = useState(0);
  const previewConfig = useMemo<TestConfig>(() => ({ ...DEFAULT_CONFIG, mode: "words", wordCount: 12 }), []);

  // scroll spy
  useEffect(() => {
    const els = SECTIONS.map((id) => document.getElementById(`s-${id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.slice(2) as (typeof SECTIONS)[number]);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const visibleThemes = THEMES.filter((t) => !t.hidden || s.unlockedThemes.includes(t.id));

  return (
    <PageShell wide>
      <PageHeader n="08" kicker="settings" title="make it yours." dek="Every change applies instantly. Type in the preview to feel it." />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[12rem_1fr]">
        <nav aria-label="Settings sections" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={`#s-${id}`}
              className={`press shrink-0 px-3 py-1.5 font-mono text-[0.78rem] transition-colors lg:border-l-2 ${active === id ? "text-fg lg:border-accent" : "text-sub hover:text-fg lg:border-transparent"}`}
            >
              {id}
            </a>
          ))}
        </nav>

        <div className="min-w-0">
          {/* live preview */}
          <div className="mb-12 border border-line bg-bg2/40 p-5 sm:p-7" style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
            <div className="label mb-3 flex items-center justify-between">
              <span>live preview</span>
              <button className="press text-sub hover:text-fg" onClick={() => setNonce((n) => n + 1)}>
                reset
              </button>
            </div>
            <TypingSurface config={previewConfig} nonce={nonce} lines={2} captureGlobal={false} focusMode={false} onFinish={() => setNonce((n) => n + 1)} onRestart={() => setNonce((n) => n + 1)} />
          </div>

          <Section id="appearance" title="appearance">
            <div className="pb-6">
              <div className="mb-4 text-[0.95rem] text-fg">theme</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visibleThemes.map((t) => {
                  const on = s.theme === t.id && !s.followSystem;
                  return (
                    <button
                      key={t.id}
                      onClick={() => set({ theme: t.id, followSystem: false })}
                      aria-pressed={on}
                      className="press group relative overflow-hidden border p-3 text-left transition-colors"
                      style={{ background: t.swatch[0], borderColor: on ? t.swatch[2] : "var(--line)", borderRadius: "calc(var(--radius) + 4px)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs" style={{ color: t.swatch[1] }}>
                          {t.name}
                        </span>
                        {on && <Check size={13} style={{ color: t.swatch[2] }} />}
                      </div>
                      <div className="mt-3 font-mono text-[0.7rem]" style={{ color: t.swatch[1], opacity: 0.55 }}>
                        the quick <span style={{ color: t.swatch[2], opacity: 1 }}>▍</span>brown
                      </div>
                      <div className="mt-2 text-[0.62rem] leading-tight" style={{ color: t.swatch[1], opacity: 0.45 }}>
                        {t.tagline}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <SettingRow title="follow system" description="Switch between a dark and a light theme with your OS.">
              <Switch checked={s.followSystem} onChange={(v) => set({ followSystem: v })} label="Follow system theme" />
            </SettingRow>
            {s.followSystem && (
              <SettingRow title="system themes" description="Which theme to use in dark and light mode.">
                <div className="flex gap-2">
                  <Select label="Dark theme" value={s.darkTheme} onChange={(v) => set({ darkTheme: v })} options={visibleThemes.filter((t) => t.dark).map((t) => ({ id: t.id, label: `dark: ${t.name}` }))} />
                  <Select label="Light theme" value={s.lightTheme} onChange={(v) => set({ lightTheme: v })} options={visibleThemes.filter((t) => !t.dark).map((t) => ({ id: t.id, label: `light: ${t.name}` }))} />
                </div>
              </SettingRow>
            )}
            <SettingRow title="typing font">
              <Select label="Typing font" value={s.font} onChange={(v) => set({ font: v })} options={FONTS} />
            </SettingRow>
            <SettingRow title="font size" description="Also the main text-size control for readability.">
              <Slider label="Font size" value={s.fontSize} min={1.2} max={3.2} step={0.1} onChange={(v) => set({ fontSize: v })} format={(v) => `${v.toFixed(1)}rem`} />
            </SettingRow>
            <SettingRow title="line height">
              <Slider label="Line height" value={s.lineHeight} min={1.4} max={2.6} step={0.1} onChange={(v) => set({ lineHeight: v })} format={(v) => v.toFixed(1)} />
            </SettingRow>
            <SettingRow title="caret style">
              <Segmented id="caret" label="Caret style" size="sm" value={s.caretStyle} onChange={(v: CaretStyle) => set({ caretStyle: v })} options={(["line", "block", "underscore", "glow", "pulse"] as CaretStyle[]).map((c) => ({ id: c, label: c }))} />
            </SettingRow>
            <SettingRow title="smooth caret" description="Glide between letters instead of jumping.">
              <Switch checked={s.smoothCaret} onChange={(v) => set({ smoothCaret: v })} label="Smooth caret" />
            </SettingRow>
            <SettingRow title="speed trail" description="A faint streak behind the caret when you're fast.">
              <Switch checked={s.caretTrail} onChange={(v) => set({ caretTrail: v })} label="Caret speed trail" />
            </SettingRow>
            <SettingRow title="background effects" description="Animated atmosphere behind everything.">
              <Switch checked={s.backgroundFx} onChange={(v) => set({ backgroundFx: v })} label="Background effects" />
            </SettingRow>
          </Section>

          <Section id="typing" title="typing">
            <SettingRow title="live wpm">
              <Switch checked={s.showLiveWpm} onChange={(v) => set({ showLiveWpm: v })} label="Show live WPM" />
            </SettingRow>
            <SettingRow title="live accuracy">
              <Switch checked={s.showLiveAcc} onChange={(v) => set({ showLiveAcc: v })} label="Show live accuracy" />
            </SettingRow>
            <SettingRow title="timer / word counter">
              <Switch checked={s.showTimer} onChange={(v) => set({ showTimer: v })} label="Show timer" />
            </SettingRow>
            <SettingRow title="progress line">
              <Switch checked={s.showProgress} onChange={(v) => set({ showProgress: v })} label="Show progress" />
            </SettingRow>
            <SettingRow title="ghost caret" description="A translucent caret replays your personal best in the same test length, so you race yourself.">
              <Switch checked={s.ghost} onChange={(v) => set({ ghost: v })} label="Ghost caret" />
            </SettingRow>
            <SettingRow title="on-screen keyboard" description="A quiet keyboard under the text that reacts to your keys.">
              <Switch checked={s.showKeyboard} onChange={(v) => set({ showKeyboard: v })} label="Show on-screen keyboard" />
            </SettingRow>
            <SettingRow title="keyboard layout" description="Used by the heatmap and on-screen keyboard.">
              <Segmented id="layout" label="Keyboard layout" size="sm" value={s.keyboardLayout} onChange={(v: KeyboardLayout) => set({ keyboardLayout: v })} options={(["qwerty", "dvorak", "colemak"] as KeyboardLayout[]).map((l) => ({ id: l, label: l }))} />
            </SettingRow>
          </Section>

          <Section id="behavior" title="behavior">
            <SettingRow title="stop on error" description="letter: wrong keys don't go in. word: can't move on until the word is right.">
              <Segmented id="soe" label="Stop on error" size="sm" value={s.test.stopOnError} onChange={(v) => s.setTest({ stopOnError: v })} options={(["off", "letter", "word"] as const).map((v) => ({ id: v, label: v }))} />
            </SettingRow>
            <SettingRow title="confidence mode" description="on: no going back to previous words. max: backspace disabled.">
              <Segmented id="conf" label="Confidence mode" size="sm" value={s.test.confidence} onChange={(v) => s.setTest({ confidence: v })} options={(["off", "on", "max"] as const).map((v) => ({ id: v, label: v }))} />
            </SettingRow>
            <SettingRow title="quick restart" description="The key that throws away the current test.">
              <Segmented id="qr" label="Quick restart key" size="sm" value={s.quickRestart} onChange={(v: QuickRestart) => set({ quickRestart: v })} options={[{ id: "tab", label: "tab" }, { id: "tab-enter", label: "tab + enter" }, { id: "esc", label: "esc" }]} />
            </SettingRow>
            <SettingRow title="language">
              <Select label="Language" value={s.test.language} onChange={(v) => s.setTest({ language: v })} options={Object.values(LANGUAGES).map((l) => ({ id: l.id, label: l.name }))} />
            </SettingRow>
            <SettingRow title="weekly goal" description="A gentle target shown on the home page. 0 turns it off.">
              <Slider label="Weekly WPM goal" value={s.weeklyGoalWpm} min={0} max={200} step={5} onChange={(v) => set({ weeklyGoalWpm: v })} format={(v) => (v ? `${v} wpm` : "off")} />
            </SettingRow>
          </Section>

          <Section id="sound" title="sound">
            <SettingRow title="sound pack" description="Synthesized in your browser. Click one to hear it.">
              <div className="flex max-w-md flex-wrap gap-1.5">
                {(["off", "mechanical", "typewriter", "soft", "retro", "digital", "bubble"] as SoundPack[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      primeAudio();
                      set({ soundPack: p });
                      if (p !== "off") {
                        const v = useSettings.getState().volume;
                        [0, 90, 170, 260].forEach((d, i) => setTimeout(() => playSound(i === 2 ? "space" : "key", p, v), d));
                      }
                    }}
                    aria-pressed={s.soundPack === p}
                    className={`press border px-3 py-1.5 font-mono text-xs ${s.soundPack === p ? "border-accent text-fg" : "border-line text-sub hover:text-fg"}`}
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="volume">
              <Slider label="Volume" value={s.volume} min={0} max={1} step={0.05} onChange={(v) => set({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </SettingRow>
            <SettingRow title="error sound" description="A low, soft thud on mistakes.">
              <Switch checked={s.errorSound} onChange={(v) => set({ errorSound: v })} label="Error sound" />
            </SettingRow>
          </Section>

          <Section id="accessibility" title="accessibility">
            <SettingRow title="motion" description="system follows your OS 'reduce motion' preference.">
              <Segmented id="motion" label="Motion" size="sm" value={s.motion} onChange={(v: MotionPref) => set({ motion: v })} options={[{ id: "system", label: "system" }, { id: "reduced", label: "reduced" }, { id: "full", label: "full" }]} />
            </SettingRow>
            <SettingRow title="high contrast" description="Stronger text and line contrast in every theme.">
              <Switch checked={s.highContrast} onChange={(v) => set({ highContrast: v })} label="High contrast" />
            </SettingRow>
            <SettingRow title="colorblind-safe errors" description="Errors switch to an orange/blue pairing. Mistakes are always underlined too, never shown by color alone.">
              <Switch checked={s.colorblind} onChange={(v) => set({ colorblind: v })} label="Colorblind-safe errors" />
            </SettingRow>
            <SettingRow title="background effects">
              <Switch checked={s.backgroundFx} onChange={(v) => set({ backgroundFx: v })} label="Background effects" />
            </SettingRow>
            <SettingRow title="sounds">
              <Switch checked={s.soundPack !== "off"} onChange={(v) => set({ soundPack: v ? "soft" : "off" })} label="Sounds" />
            </SettingRow>
          </Section>

          <PrivacySection />
          <AccountSection />

          <div className="mt-10 flex justify-end">
            <button
              onClick={() => {
                if (confirm("Reset every setting to its default?")) s.reset();
              }}
              className="press font-mono text-xs text-sub hover:text-err"
            >
              reset all settings
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`s-${id}`} className="mb-14 scroll-mt-8">
      <h2 className="display mb-2 text-4xl font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function PrivacySection() {
  const s = useSettings();
  const tests = useHistory((h) => h.tests);
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings: s, tests }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clack-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Section id="privacy" title="privacy">
      <SettingRow title="keep results on this device" description="When signed in, don't upload new results to your account.">
        <Switch checked={s.privateMode} onChange={(v) => s.set({ privateMode: v })} label="Keep results local" />
      </SettingRow>
      <SettingRow title="export your data" description={`${tests.length} tests and all settings as JSON.`}>
        <button onClick={exportData} className="press inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
          <Download size={13} /> export
        </button>
      </SettingRow>
      <SettingRow title="clear local history" description="Deletes tests stored in this browser. Account data is untouched.">
        <button
          onClick={() => {
            if (confirm("Delete all tests stored in this browser? This can't be undone.")) {
              useHistory.getState().clearLocal();
              useUI.getState().toast({ title: "local history cleared" });
            }
          }}
          className="press inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-xs text-sub hover:border-err hover:text-err"
          style={{ borderRadius: "var(--radius)" }}
        >
          <Trash2 size={13} /> clear
        </button>
      </SettingRow>
    </Section>
  );
}

function AccountSection() {
  const auth = useClientAuth();
  const router = useRouter();
  const importable = useHistory((h) => h.importable);
  const source = useHistory((h) => h.source);
  return (
    <Section id="account" title="account">
      {!auth.enabled ? (
        <p className="border-b border-line py-5 text-sm text-sub">
          Accounts aren&apos;t configured on this deployment, so everything lives in this browser. (Add Clerk keys to enable sign-in. See the README.)
        </p>
      ) : auth.signedIn ? (
        <>
          <SettingRow title={auth.name ?? "signed in"} description={source === "remote" ? "Results sync to your account." : "Signed in, but the database isn't reachable. Results are kept locally for now."}>
            <div className="flex gap-2">
              <button onClick={() => router.push("/profile")} className="press border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
                profile
              </button>
              <button onClick={auth.openProfile} className="press border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
                manage account
              </button>
              <button onClick={auth.signOut} className="press border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-err" style={{ borderRadius: "var(--radius)" }}>
                sign out
              </button>
            </div>
          </SettingRow>
          {importable > 0 && (
            <SettingRow title="import local history" description={`${importable} tests from before you signed in are still on this device.`}>
              <button
                onClick={async () => {
                  const n = await useHistory.getState().importAnonymous();
                  useUI.getState().toast({ title: `imported ${n} tests`, tone: "accent" });
                }}
                className="press bg-accent px-3 py-1.5 font-mono text-xs text-on-accent"
                style={{ borderRadius: "var(--radius)" }}
              >
                import
              </button>
            </SettingRow>
          )}
        </>
      ) : (
        <SettingRow title="you're typing anonymously" description="Everything works without an account. Sign in to keep history across devices.">
          <button onClick={auth.openSignIn} className="press bg-accent px-3 py-1.5 font-mono text-xs text-on-accent" style={{ borderRadius: "var(--radius)" }}>
            sign in
          </button>
        </SettingRow>
      )}
    </Section>
  );
}
