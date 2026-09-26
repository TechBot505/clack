import type { Metadata } from "next";
import { DailyPlayClient } from "./DailyPlayClient";

export const metadata: Metadata = { title: "daily challenge" };

export default function DailyPlayPage() {
  return <DailyPlayClient />;
}
