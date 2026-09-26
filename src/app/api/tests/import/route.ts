import { handler, json, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { importSchema } from "@/server/schemas";
import { recordFromImported, saveVerified, verifyRun } from "@/server/tests-service";

export const dynamic = "force-dynamic";

/**
 * Migrate anonymous local history into the account. Tests that still have a
 * keystroke log are fully re-verified; older ones without a log are kept for
 * personal stats but marked unverified (never used for leaderboards).
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`import:${user.id}`, LIMITS.import);
  const { items } = await parseBody(req, importSchema, 4_000_000);
  const prisma = db()!;
  let imported = 0;
  let skipped = 0;
  for (const item of items) {
    try {
      if (item.log) {
        const v = verifyRun(item.input, item.log);
        const res = await saveVerified(prisma, user.id, v.input, item.log, v.record, v.reasons);
        if (res.duplicate) skipped++;
        else imported++;
      } else {
        const rec = recordFromImported(item.input, item.record);
        const res = await saveVerified(prisma, user.id, { ...item.input, createdAt: Math.min(item.input.createdAt, Date.now()) }, null, rec, ["unverified_import"]);
        if (res.duplicate) skipped++;
        else imported++;
      }
    } catch {
      skipped++;
    }
  }
  return json({ imported, skipped });
});
