import type { Metadata } from "next";
import { FocusClient } from "./FocusClient";

export const metadata: Metadata = { title: "focus" };

export default function FocusPage() {
  return <FocusClient />;
}
