import type { Metadata } from "next";
import { StatsClient } from "./StatsClient";

export const metadata: Metadata = { title: "stats" };

export default function StatsPage() {
  return <StatsClient />;
}
