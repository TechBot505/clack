import type { Metadata } from "next";
import { RaceClient } from "./RaceClient";

export const metadata: Metadata = { title: "race" };

export default function RacePage() {
  return <RaceClient />;
}
