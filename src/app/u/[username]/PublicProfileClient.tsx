"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, UserMinus, UserPlus } from "lucide-react";
import { api, ApiError, type PublicProfile } from "@/lib/api";
import { computeStreaks, computeTotals } from "@/lib/records";
import { buildFingerprint } from "@/lib/fingerprint";
import { evaluateAchievements, ACHIEVEMENTS } from "@/lib/achievements";
import { levelFor } from "@/lib/progression";
import { categoryLabel } from "@/engine/config";
import { describeTest, fmtDate, fmtDuration, fmtNumber, relativeTime } from "@/lib/format";
import { PageShell, SectionTitle, Stat, EmptyState } from "@/components/ui/primitives";
import { DnaArt } from "@/components/profile/TypingDNA";
import { useClientAuth } from "@/lib/auth-client";
import { useUI } from "@/stores/ui";

export function PublicProfileClient({ username }: { username: string }) {
  const auth = useClientAuth();
  const [data, setData] = useState<{ key: string; profile: PublicProfile | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `${username}|${auth.userId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    api
      .profile(username)
      .then((p) => !cancelled && setData({ key, profile: p, error: null }))
      .catch((e) => !cancelled && setData({ key, profile: null, error: e instanceof ApiError ? String(e.status) : "error" }));
    return () => {
      cancelled = true;
    };
  }, [username, key]);

  const cur = data?.key === key ? data : null;
  const p = cur?.profile ?? null;
  const tests = useMemo(() => p?.tests ?? [], [p]);
  const totals = useMemo(() => computeTotals(tests), [tests]);
  const streaks = useMemo(() => computeStreaks(tests), [tests]);
  const fp = useMemo(() => (tests.length >= 3 ? buildFingerprint(tests, []) : null), [tests]);
  const ach = useMemo(() => evaluateAchievements(tests, {}), [tests]);

  if (!cur) return <PageShell><div className="h-[60vh]" /></PageShell>;
  if (cur.error === "404") return <PageShell><EmptyState title={`No one called @${username}.`} body="Handles are lowercase. Maybe a typo? It happens to the best of us." action={{ href: "/", label: "home" }} /></PageShell>;
  if (cur.error === "503") return <PageShell><EmptyState title="Profiles need accounts." body="This deployment runs in local-only mode, so there are no public profiles here." action={{ href: "/profile", label: "your profile" }} /></PageShell>;
  if (!p) return <PageShell><EmptyState title="Couldn't load this profile." body="Try again in a moment." /></PageShell>;

  const name = p.user.username ?? p.user.displayName ?? "typist";
  const level = levelFor(p.user.xp).level;

  const toggleFollow = async () => {
    if (!auth.signedIn) return auth.openSignIn();
    setBusy(true);
    try {
      const r = await api.follow(username, !p.following);
      setData({ ...cur, profile: { ...p, following: r.following, followers: p.followers + (r.following ? 1 : -1) } });
    } catch (e) {
      useUI.getState().toast({ title: "couldn't update", body: e instanceof Error ? e.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell wide>
      <header className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-6">
          {p.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.user.avatarUrl} alt="" className="h-20 w-20 object-cover" style={{ borderRadius: "calc(var(--radius) + 6px)" }} />
          ) : fp ? (
            <div className="h-20 w-20 border border-line" style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
              <DnaArt fp={fp} seed={name} animate={false} className="h-full w-full" />
            </div>
          ) : null}
          <div>
            <div className="label">
              level {level} · {p.followers} follower{p.followers === 1 ? "" : "s"} · {p.followingCount} following
              {p.followsYou && !p.self ? " · follows you" : ""}
            </div>
            <h1 className="display mt-2 text-[clamp(2.6rem,6vw,5rem)] font-semibold">@{name}</h1>
            <p className="font-mono text-xs text-sub">typing since {fmtDate(p.user.createdAt)}</p>
          </div>
        </div>
        {p.self ? (
          <Link href="/profile" className="press border border-line px-4 py-2 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
            this is you · edit
          </Link>
        ) : (
          <button onClick={toggleFollow} disabled={busy} className={`press inline-flex items-center gap-2 px-4 py-2 font-mono text-xs ${p.following ? "border border-line text-sub hover:text-fg" : "bg-accent text-on-accent"}`} style={{ borderRadius: "var(--radius)" }}>
            {p.following ? <UserMinus size={13} /> : <UserPlus size={13} />} {p.following ? "unfollow" : "follow"}
          </button>
        )}
      </header>

      {p.hidden ? (
        <div className="flex items-center gap-3 border border-dashed border-line p-8 text-sub" style={{ borderRadius: "var(--radius)" }}>
          <Lock size={16} /> This profile is private{p.following ? " (friends only: they need to follow you back)" : ""}.
        </div>
      ) : (
        <>
          <section className="mb-14 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="current wpm" value={totals.recentWpm.toFixed(0)} big />
            <Stat label="best wpm" value={totals.bestWpm.toFixed(0)} big />
            <Stat label="average wpm" value={totals.avgWpm.toFixed(0)} big />
            <Stat label="accuracy" value={`${totals.avgAcc.toFixed(1)}%`} big />
            <Stat label="tests" value={fmtNumber(totals.tests)} big />
            <Stat label="streak" value={`${streaks.current}d`} big sub={`longest ${streaks.longest}d`} />
            <Stat label="words typed" value={fmtNumber(totals.words)} />
            <Stat label="characters" value={fmtNumber(totals.chars)} />
            <Stat label="typing time" value={fmtDuration(totals.timeMs)} />
          </section>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <section>
              <SectionTitle n="a">personal bests</SectionTitle>
              {p.pbs.length ? (
                <ul>
                  {[...p.pbs].sort((a, b) => a.category.localeCompare(b.category)).map((pb) => (
                    <li key={pb.category} className="flex items-baseline justify-between border-b border-line py-2.5">
                      <span className="font-mono text-sm text-sub">{categoryLabel(pb.category)}</span>
                      <span className="display text-2xl font-semibold">
                        {pb.wpm.toFixed(0)} <span className="font-mono text-xs text-faint">{pb.accuracy.toFixed(0)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-sub">No verified records yet.</p>
              )}
            </section>
            <section>
              <SectionTitle n="b">recent</SectionTitle>
              <ul>
                {tests.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between border-b border-line py-2.5">
                    <span className="font-mono text-xs text-sub">
                      {describeTest(t)} · {relativeTime(t.createdAt)}
                    </span>
                    <span className="font-mono text-sm text-fg">
                      {t.wpm.toFixed(0)} wpm · {t.accuracy.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="mt-14">
            <SectionTitle n="c">achievements · {Object.keys(ach).length}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {ACHIEVEMENTS.filter((a) => ach[a.id]).map((a) => (
                <span key={a.id} className="border border-accent/50 px-3 py-1.5 font-mono text-xs text-fg" style={{ borderRadius: "var(--radius)" }} title={a.description}>
                  ✦ {a.name}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
