import type { Metadata } from "next";
import { DailyClient } from "./DailyClient";

export const metadata: Metadata = { title: "daily challenge" };

export default function DailyPage() {
  return <DailyClient />;
}
