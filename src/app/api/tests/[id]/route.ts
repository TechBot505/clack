import { handler, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { eventMeta, recomputePb, toRecord, withEventMeta } from "@/server/tests-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function find(userId: string, id: string) {
  const prisma = db()!;
  return prisma.typingTest.findFirst({
    where: { userId, OR: [{ clientId: id }, { id }] },
    include: { events: true },
  });
}

/** One test with its keystroke log (for replays). */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  rateLimit(`read:${user.id}`, LIMITS.read);
  const { id } = await ctx.params;
  const row = await find(user.id, decodeURIComponent(id).slice(0, 64));
  if (!row) throw new HttpError(404, "not found");
  const ev = row.events;
  const test = withEventMeta(toRecord(row), ev?.text ?? null, eventMeta(ev?.meta));
  const log = ev && ev.keys.length ? { keys: ev.keys, deltas: ev.deltas, endMs: ev.endMs } : null;
  return json({ test, log });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  rateLimit(`write:${user.id}`, LIMITS.write);
  const { id } = await ctx.params;
  const row = await find(user.id, decodeURIComponent(id).slice(0, 64));
  if (!row) throw new HttpError(404, "not found");
  const prisma = db()!;
  await prisma.$transaction(async (tx) => {
    await tx.typingTest.delete({ where: { id: row.id } });
    // if it held a personal best, recompute that category from what's left
    const pbs = await tx.personalBest.findMany({ where: { userId: user.id, testId: row.id } });
    for (const pb of pbs) {
      await tx.personalBest.delete({ where: { id: pb.id } });
      await recomputePb(tx, user.id, pb.category);
    }
  });
  return json({ ok: true });
});
