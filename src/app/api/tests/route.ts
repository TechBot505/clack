import { handler, json, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { saveTestSchema } from "@/server/schemas";
import { eventMeta, saveVerified, toRecord, verifyRun, withEventMeta } from "@/server/tests-service";

export const dynamic = "force-dynamic";

/** List the signed-in user's tests (summaries, newest first). */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`read:${user.id}`, LIMITS.read);
  const url = new URL(req.url);
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? 500) || 500));
  const rows = await db()!.typingTest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { events: { select: { text: true, meta: true } } },
  });
  return json({ tests: rows.map((r) => withEventMeta(toRecord(r), r.events?.text ?? null, eventMeta(r.events?.meta))) });
});

/** Save a finished test. The server replays the keystrokes and computes every number itself. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`save:${user.id}`, LIMITS.save);
  const { input, log } = await parseBody(req, saveTestSchema);
  const verified = verifyRun(input, log);
  const { row, pbCats } = await saveVerified(db()!, user.id, verified.input, log, verified.record, verified.reasons);
  const rec = withEventMeta(toRecord(row), verified.input.customText ?? null, {
    stopOnError: verified.input.stopOnError,
    confidence: verified.input.confidence,
    strict: verified.input.strict,
  });
  return json({ test: rec, pbs: pbCats }, { status: 201 });
});
