import type { Metadata } from "next";
import { BurstClient } from "./BurstClient";

export const metadata: Metadata = { title: "burst" };

export default function BurstPage() {
  return <BurstClient />;
}
