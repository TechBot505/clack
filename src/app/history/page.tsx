import type { Metadata } from "next";
import { HistoryClient } from "./HistoryClient";

export const metadata: Metadata = { title: "history" };

export default function HistoryPage() {
  return <HistoryClient />;
}
