import { json } from "@/server/http";
import { clerkEnabled, databaseEnabled } from "@/server/env";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ database: databaseEnabled, auth: clerkEnabled });
}
