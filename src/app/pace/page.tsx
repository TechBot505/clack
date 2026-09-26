import type { Metadata } from "next";
import { PaceClient } from "./PaceClient";

export const metadata: Metadata = { title: "consistency challenge" };

export default function PacePage() {
  return <PaceClient />;
}
