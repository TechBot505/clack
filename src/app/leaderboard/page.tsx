import type { Metadata } from "next";
import { LeaderboardClient } from "./LeaderboardClient";

export const metadata: Metadata = { title: "leaderboards" };

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
