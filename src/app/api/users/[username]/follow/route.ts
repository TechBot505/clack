import { handler, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

async function target(username: string) {
  const u = await db()!.user.findUnique({ where: { username: decodeURIComponent(username).toLowerCase().slice(0, 20) }, select: { id: true } });
  if (!u) throw new HttpError(404, "no such typist");
  return u;
}

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireUser();
  rateLimit(`write:${me.id}`, LIMITS.write);
  const t = await target((await ctx.params).username);
  if (t.id === me.id) throw new HttpError(400, "you already follow yourself, in spirit");
  await db()!.friendship.upsert({
    where: { followerId_followingId: { followerId: me.id, followingId: t.id } },
    update: {},
    create: { followerId: me.id, followingId: t.id },
  });
  return json({ following: true });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireUser();
  rateLimit(`write:${me.id}`, LIMITS.write);
  const t = await target((await ctx.params).username);
  await db()!.friendship.deleteMany({ where: { followerId: me.id, followingId: t.id } });
  return json({ following: false });
});
