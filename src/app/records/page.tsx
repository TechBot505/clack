import type { Metadata } from "next";
import { RecordsClient } from "./RecordsClient";

export const metadata: Metadata = { title: "records" };

export default function RecordsPage() {
  return <RecordsClient />;
}
