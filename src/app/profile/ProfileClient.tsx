"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHistory } from "@/stores/history";
import { computeStreaks, computeTotals } from "@/lib/records";
import { categoryLabel } from "@/engine/config";
import { fmtDate, fmtDuration, fmtNumber } from "@/lib/format";
import { PageShell, SectionTitle, Stat, Segmented, EmptyState } from "@/components/ui/primitives";
import { TestRow } from "@/components/history/TestRow";
import { useClientAuth } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { useUI } from "@/stores/ui";
import { ProfileExtras } from "@/components/profile/ProfileExtras";

export function ProfileClient() {
  const tests = useHistory((s) => s.tests);
  const loaded = useHistory((s) => s.loaded);
  const source = useHistory((s) => s.source);
  const auth = useClientAuth();
  const totals = useMemo(() => computeTotals(tests), [tests]);
  const streaks = useMemo(() => computeStreaks(tests), [tests]);
  const favorite = useMemo(() => {
    const counts = new Map<string, number>();
    tests.forEach((t) => counts.set(t.category, (counts.get(t.category) ?? 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? categoryLabel(top[0]) : "–";
  }, [tests]);
  const since = tests.length ? Math.min(...tests.map((t) => t.createdAt)) : null;
  const name = auth.signedIn ? auth.name ?? "you" : "anonymous typist";

  if (loaded && tests.length === 0) {
    return (
      <PageShell>
        <Identity name={name} image={auth.imageUrl} since={null} />
        <EmptyState title="A profile is a story told in keystrokes." body="Yours starts after your first test." action={{ href: "/type", label: "write the first chapter" }} />
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <Identity name={name} image={auth.imageUrl} since={since} />

      <section className="mb-16 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="current wpm" value={totals.recentWpm.toFixed(0)} big />
        <Stat label="best wpm" value={totals.bestWpm.toFixed(0)} big />
        <Stat label="average wpm" value={totals.avgWpm.toFixed(0)} big />
        <Stat label="accuracy" value={`${totals.avgAcc.toFixed(1)}%`} big />
        <Stat label="current streak" value={`${streaks.current}d`} big sub={`longest ${streaks.longest}d`} />
        <Stat label="tests" value={fmtNumber(totals.tests)} big />
        <Stat label="words typed" value={fmtNumber(totals.words)} />
        <Stat label="characters" value={fmtNumber(totals.chars)} />
        <Stat label="typing time" value={fmtDuration(totals.timeMs)} />
        <Stat label="favorite mode" value={favorite} />
        <Stat label="consistency" value={`${totals.avgConsistency.toFixed(0)}%`} />
        <Stat label="longest streak" value={`${streaks.longest} days`} />
      </section>

      <ProfileExtras tests={tests} />

      <section className="mb-16">
        <SectionTitle n="e" right={<Link href="/history" className="font-mono text-xs text-sub hover:text-fg">all history →</Link>}>
          recent results
        </SectionTitle>
        {tests.slice(0, 6).map((t) => (
          <TestRow key={t.id} t={t} />
        ))}
      </section>

      {auth.signedIn && source === "remote" && <AccountProfile />}
    </PageShell>
  );
}

/** Generative monogram: a deterministic little mark per name. */
function Monogram({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells = Array.from({ length: 25 }, (_, i) => ((h >> (i % 24)) & 1) === 1);
  return (
    <div className="grid h-20 w-20 grid-cols-5 gap-0.5 bg-bg2 p-2" style={{ borderRadius: "calc(var(--radius) + 6px)" }} aria-hidden>
      {cells.map((on, i) => {
        const col = i % 5;
        const mirror = cells[Math.floor(i / 5) * 5 + (4 - col)];
        const lit = col > 2 ? mirror : on;
        return <span key={i} style={{ background: lit ? "var(--accent)" : "transparent", borderRadius: 2 }} />;
      })}
    </div>
  );
}

function Identity({ name, image, since }: { name: string; image: string | null; since: number | null }) {
  return (
    <header className="mb-14 flex flex-wrap items-end gap-6">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-20 w-20 object-cover" style={{ borderRadius: "calc(var(--radius) + 6px)" }} />
      ) : (
        <Monogram name={name} />
      )}
      <div>
        <div className="label flex items-center gap-3">
          <span className="text-accent">06</span>
          <span className="h-px w-8 bg-line" />
          <span>profile</span>
        </div>
        <h1 className="display mt-3 text-[clamp(2.6rem,6vw,5rem)] font-semibold">{name}</h1>
        {since && <p className="mt-1 font-mono text-xs text-sub">typing since {fmtDate(since)}</p>}
      </div>
    </header>
  );
}

function AccountProfile() {
  const [username, setUsername] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        if (!user) return;
        setUsername(user.username ?? "");
        setVisibility((user.visibility as "public" | "friends" | "private") ?? "public");
      })
      .catch(() => {});
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      await api.updateMe({ username: username || undefined, visibility });
      useUI.getState().toast({ title: "profile saved", tone: "accent" });
    } catch (e) {
      useUI.getState().toast({ title: "couldn't save", body: e instanceof Error ? e.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mb-10 max-w-2xl">
      <SectionTitle n="f">public profile</SectionTitle>
      <div className="space-y-5">
        <label className="block">
          <span className="label">username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            placeholder="pick-a-handle"
            className="mt-2 block w-full max-w-xs border border-line bg-bg2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
            style={{ borderRadius: "var(--radius)" }}
          />
        </label>
        <div>
          <div className="label mb-2">who can see your profile</div>
          <Segmented id="vis" label="Profile visibility" size="sm" value={visibility} onChange={setVisibility} options={[{ id: "public", label: "everyone" }, { id: "friends", label: "friends" }, { id: "private", label: "only me" }]} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={save} disabled={saving} className="press bg-accent px-4 py-2 font-mono text-xs text-on-accent disabled:opacity-50" style={{ borderRadius: "var(--radius)" }}>
            {saving ? "saving…" : "save"}
          </button>
          {username && (
            <Link href={`/u/${username}`} className="font-mono text-xs text-sub underline decoration-line underline-offset-4 hover:text-fg">
              view public page → /u/{username}
            </Link>
          )}
        </div>
        <form
          className="flex items-center gap-2 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = (new FormData(e.currentTarget).get("q") as string | null)?.trim().toLowerCase().replace(/^@/, "");
            if (v) window.location.href = `/u/${encodeURIComponent(v)}`;
          }}
        >
          <input name="q" placeholder="find a typist: @handle" className="w-full max-w-xs border border-line bg-bg2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent" style={{ borderRadius: "var(--radius)" }} />
          <button type="submit" className="press font-mono text-xs text-sub hover:text-fg">
            go
          </button>
        </form>
      </div>
    </section>
  );
}
