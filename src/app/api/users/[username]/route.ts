import { handler, HttpError, json } from "@/server/http";
import { getUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/http";
import { toRecord } from "@/server/tests-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

/** Public profile. Respects visibility: public, friends (mutual follow) or private. */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const prisma = db();
  if (!prisma) throw new HttpError(503, "database not configured");
  const viewer = await getUser();
  rateLimit(`profile:${viewer?.id ?? clientIp(req)}`, LIMITS.read);
  const { username } = await ctx.params;
  const handle = decodeURIComponent(username).toLowerCase().slice(0, 20);
  const user = await prisma.user.findUnique({
    where: { username: handle },
    select: { id: true, username: true, displayName: true, avatarUrl: true, visibility: true, createdAt: true, xp: true },
  });
  if (!user) throw new HttpError(404, "no such typist");
  const self = viewer?.id === user.id;
  const [iFollow, followsMe, followers, following] = await Promise.all([
    viewer ? prisma.friendship.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } } }) : null,
    viewer ? prisma.friendship.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: viewer.id } } }) : null,
    prisma.friendship.count({ where: { followingId: user.id } }),
    prisma.friendship.count({ where: { followerId: user.id } }),
  ]);
  const allowed = self || user.visibility === "public" || (user.visibility === "friends" && !!iFollow && !!followsMe);
  const base = {
    user: { username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt.getTime(), xp: user.xp },
    self,
    following: !!iFollow,
    followsYou: !!followsMe,
    followers,
    followingCount: following,
  };
  if (!allowed) return json({ ...base, hidden: true, tests: [], pbs: [] });
  const [rows, pbs] = await Promise.all([
    prisma.typingTest.findMany({ where: { userId: user.id, flagged: false }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.personalBest.findMany({ where: { userId: user.id } }),
  ]);
  return json({
    ...base,
    hidden: false,
    tests: rows.map(toRecord),
    pbs: pbs.map((p) => ({ category: p.category, wpm: p.wpm, accuracy: p.accuracy, at: p.achievedAt.getTime() })),
  });
});
