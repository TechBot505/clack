import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/server/http";
import { getUser, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { dailySpec, utcDay } from "@/lib/daily";
import { textSpecFor } from "@/engine/config";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function challengeFor(date: string) {
  const spec = dailySpec(date);
  return db()!.dailyChallenge.upsert({
    where: { date },
    update: {},
    create: { date, seed: spec.seed, config: spec.config as unknown as Prisma.InputJsonValue },
  });
}

/** Today's leaderboard (official attempts only, flagged runs excluded). */
export const GET = handler(async (req: Request) => {
  if (!db()) throw new HttpError(503, "database not configured");
  const date = dateSchema.parse(new URL(req.url).searchParams.get("date") ?? utcDay());
  const me = await getUser();
  rateLimit(`read:${me?.id ?? "anon"}`, LIMITS.read);
  const challenge = await db()!.dailyChallenge.findUnique({ where: { date } });
  if (!challenge) return json({ date, entries: [], total: 0, you: null });
  const where = { challengeId: challenge.id, official: true, test: { flagged: false } };
  const [top, total, mine] = await Promise.all([
    db()!.dailyChallengeAttempt.findMany({
      where,
      orderBy: [{ wpm: "desc" }, { accuracy: "desc" }, { createdAt: "asc" }],
      take: 20,
      include: { user: { select: { id: true, username: true, displayName: true, visibility: true } } },
    }),
    db()!.dailyChallengeAttempt.count({ where }),
    me ? db()!.dailyChallengeAttempt.findFirst({ where: { ...where, userId: me.id } }) : null,
  ]);
  let you = null;
  if (mine) {
    const better = await db()!.dailyChallengeAttempt.count({ where: { ...where, wpm: { gt: mine.wpm } } });
    you = { wpm: mine.wpm, accuracy: mine.accuracy, rank: better + 1, percentile: total > 1 ? ((total - better - 1) / (total - 1)) * 100 : 100 };
  }
  return json({
    date,
    total,
    you,
    entries: top.map((a, i) => ({
      rank: i + 1,
      name: a.user.visibility === "private" && a.user.id !== me?.id ? "anonymous" : (a.user.username ?? a.user.displayName ?? "anonymous"),
      wpm: a.wpm,
      accuracy: a.accuracy,
      you: a.user.id === me?.id,
    })),
  });
});

/** Register a finished test as today's attempt. First valid one is official. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`write:${user.id}`, LIMITS.write);
  const { date, testId } = await parseBody(req, z.object({ date: dateSchema, testId: z.string().max(64) }), 2_000);
  if (date !== utcDay()) throw new HttpError(400, "that challenge is closed");
  const test = await db()!.typingTest.findFirst({ where: { userId: user.id, clientId: testId } });
  if (!test) throw new HttpError(404, "test not found");

  // the test must be exactly today's challenge
  const spec = dailySpec(date);
  const expected = textSpecFor(spec.config, spec.seed);
  const matches =
    test.mode === spec.config.mode &&
    (expected.kind === "words"
      ? test.seed === spec.seed && test.punctuation === spec.config.punctuation && test.numbers === spec.config.numbers && test.content === spec.config.content && test.mode2 === (spec.config.mode === "time" ? spec.config.duration : spec.config.wordCount)
      : expected.kind === "quote" || expected.kind === "code"
        ? test.sourceId === expected.id
        : false);
  if (!matches) throw new HttpError(400, "not today's challenge");

  const challenge = await challengeFor(date);
  const existingOfficial = await db()!.dailyChallengeAttempt.findFirst({ where: { challengeId: challenge.id, userId: user.id, official: true } });
  const already = await db()!.dailyChallengeAttempt.findUnique({ where: { testId: test.id } });
  if (already) return json({ official: already.official });
  const official = !existingOfficial && !test.flagged;
  await db()!.dailyChallengeAttempt.create({
    data: { challengeId: challenge.id, userId: user.id, testId: test.id, official, wpm: test.wpm, accuracy: test.accuracy },
  });
  return json({ official });
});
