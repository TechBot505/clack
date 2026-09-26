"use client";

import Link from "next/link";
import { useSettings } from "@/stores/settings";

export function Footer() {
  const quick = useSettings((s) => s.quickRestart);
  return (
    <footer className="chrome relative z-10 mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 pb-6 pt-10 font-mono text-[0.7rem] text-faint sm:px-8">
      <div className="hidden items-center gap-4 md:flex">
        <span>
          <kbd>{quick === "esc" ? "esc" : "tab"}</kbd>
          {quick === "tab-enter" ? <> + <kbd>enter</kbd></> : null} restart
        </span>
        <span>
          <kbd>esc</kbd> controls
        </span>
        <span>
          <kbd>ctrl</kbd> + <kbd>k</kbd> commands
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/settings" className="hover:text-sub">
          settings
        </Link>
        <Link href="/records" className="hover:text-sub">
          records
        </Link>
        <Link href="/leaderboard" className="hover:text-sub">
          leaderboards
        </Link>
        <span className="text-faint/70">clack. v0.1</span>
      </div>
    </footer>
  );
}
