import type { Metadata } from "next";
import { InternetClient } from "./InternetClient";

export const metadata: Metadata = { title: "type the internet" };

export default function InternetPage() {
  return <InternetClient />;
}
