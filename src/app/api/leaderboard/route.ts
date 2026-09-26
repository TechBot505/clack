import { z } from "zod";
import { handler, HttpError, json } from "@/server/http";
import { getUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/http";

export const dynamic = "force-dynamic";

const q = z.object({
  category: z.string().regex(/^(time:\d{1,3}|words:\d{1,4}|quote|code)$/).default("time:60"),
  range: z.enum(["daily", "weekly", "monthly", "all"]).default("weekly"),
  language: z.string().max(40).default("english"),
  friends: z.enum(["0", "1"]).default("0"),
});

const SINCE: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

/**
 * Best verified result per user in a category. Only server-verified runs
 * count: flagged tests and unverified imports are excluded.
 */
export const GET = handler(async (req: Request) => {
  const prisma = db();
  if (!prisma) throw new HttpError(503, "database not configured");
  const me = await getUser();
  rateLimit(`lb:${me?.id ?? clientIp(req)}`, LIMITS.read);
  const params = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const since = params.range === "all" ? undefined : new Date(Date.now() - SINCE[params.range] * 86400000);

  let userFilter: { in: string[] } | undefined;
  if (params.friends === "1") {
    if (!me) throw new HttpError(401, "sign in required");
    const follows = await prisma.friendship.findMany({ where: { followerId: me.id }, select: { followingId: true } });
    userFilter = { in: [me.id, ...follows.map((f) => f.followingId)] };
  }

  const groups = await prisma.typingTest.groupBy({
    by: ["userId"],
    where: {
      category: params.category,
      language: params.language,
      punctuation: false,
      numbers: false,
      content: "common",
      flagged: false,
      flagReasons: { isEmpty: true },
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(userFilter ? { userId: userFilter } : {}),
      user: params.friends === "1" ? undefined : { visibility: { not: "private" } },
    },
    _max: { wpm: true },
    orderBy: { _max: { wpm: "desc" } },
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: groups.map((g) => g.userId) } },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return json({
    category: params.category,
    range: params.range,
    entries: groups.map((g, i) => {
      const u = byId.get(g.userId);
      return { rank: i + 1, name: u?.username ?? u?.displayName ?? "anonymous", avatar: u?.avatarUrl ?? null, wpm: g._max.wpm ?? 0, you: g.userId === me?.id };
    }),
  });
});
