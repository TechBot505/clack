"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { PageHeader, PageShell, Segmented } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api";
import { useClientAuth } from "@/lib/auth-client";

const CATEGORIES = [
  { id: "time:15", label: "15s" },
  { id: "time:30", label: "30s" },
  { id: "time:60", label: "60s" },
  { id: "time:120", label: "120s" },
  { id: "words:25", label: "25w" },
  { id: "words:50", label: "50w" },
  { id: "quote", label: "quote" },
  { id: "code", label: "code" },
];
const RANGES = [
  { id: "daily", label: "today" },
  { id: "weekly", label: "week" },
  { id: "monthly", label: "month" },
  { id: "all", label: "all time" },
];

type Entry = { rank: number; name: string; avatar: string | null; wpm: number; you: boolean };

export function LeaderboardClient() {
  const auth = useClientAuth();
  const [category, setCategory] = useState("time:60");
  const [range, setRange] = useState("weekly");
  const [friends, setFriends] = useState(false);
  const [state, setState] = useState<{ key: string; entries: Entry[] | null; error: string | null } | null>(null);
  const key = `${category}|${range}|${friends}`;

  useEffect(() => {
    let cancelled = false;
    api
      .leaderboard({ category, range, friends })
      .then((r) => !cancelled && setState({ key, entries: r.entries, error: null }))
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof ApiError && e.status === 503 ? "offline" : e instanceof ApiError && e.status === 401 ? "signin" : "error";
        setState({ key, entries: null, error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [category, range, friends, key]);

  const cur = state?.key === key ? state : null;

  return (
    <PageShell>
      <PageHeader
        n="09"
        kicker="leaderboards"
        title={
          <>
            fastest <span className="italic-serif font-normal text-accent">fingers</span>
          </>
        }
        dek="Only server-verified runs count: every keystroke replayed, anything suspicious left out. Plain English, no punctuation or numbers."
      />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Segmented id="lb-cat" label="Category" size="sm" value={category} onChange={setCategory} options={CATEGORIES} />
        <Segmented id="lb-range" label="Range" size="sm" value={range} onChange={setRange} options={RANGES} />
        {auth.signedIn && <Segmented id="lb-friends" label="Scope" size="sm" value={friends ? "friends" : "global"} onChange={(v) => setFriends(v === "friends")} options={[{ id: "global", label: "global" }, { id: "friends", label: "friends" }]} />}
      </div>

      {!cur ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse bg-bg2/60" style={{ borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : cur.error === "offline" ? (
        <p className="max-w-lg text-sub">Leaderboards need accounts and a database, and this deployment runs in local-only mode. Your own records live on the records page.</p>
      ) : cur.error === "signin" ? (
        <p className="text-sub">Sign in to see how you stack up against your friends.</p>
      ) : cur.error ? (
        <p className="text-sub">Couldn&apos;t load the leaderboard. Try again in a moment.</p>
      ) : !cur.entries?.length ? (
        <p className="text-sub">Nobody has a verified run here yet. The top spot is open.</p>
      ) : (
        <ol>
          {cur.entries.map((e, i) => (
            <motion.li
              key={`${e.rank}-${e.name}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.025 }}
              className={`grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-line py-3 ${e.you ? "text-accent" : "text-fg"}`}
            >
              <span className={`font-mono ${e.rank <= 3 ? "text-accent" : "text-faint"}`}>{e.rank <= 3 ? <Trophy size={15} /> : e.rank}</span>
              <span className="truncate font-mono text-sm">{e.name}</span>
              <span className="display text-2xl font-semibold">
                {e.wpm.toFixed(0)} <span className="font-mono text-xs text-faint">wpm</span>
              </span>
            </motion.li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
