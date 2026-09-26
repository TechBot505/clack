import type { Metadata } from "next";
import { TestDetailClient } from "./TestDetailClient";

export const metadata: Metadata = { title: "test" };

export default async function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestDetailClient id={decodeURIComponent(id)} />;
}
