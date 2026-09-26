import type { Metadata } from "next";
import { TypePageClient } from "./TypePageClient";

export const metadata: Metadata = {
  title: "type",
  description: "The clack. typing test: time, words, quotes, code, zen and flow.",
};

export default function TypePage() {
  return <TypePageClient />;
}
