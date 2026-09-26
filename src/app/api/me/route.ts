import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/server/http";
import { getUser, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const u = await getUser();
  if (!u) return json({ user: null });
  const user = await db()!.user.findUnique({
    where: { id: u.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true, visibility: true, createdAt: true, xp: true },
  });
  return json({ user });
});

const RESERVED = new Set(["admin", "clack", "api", "settings", "profile", "root", "support", "anonymous"]);

const patchSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers and _ only")
    .optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  visibility: z.enum(["public", "friends", "private"]).optional(),
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`write:${user.id}`, LIMITS.write);
  const patch = await parseBody(req, patchSchema, 4_000);
  if (patch.username && RESERVED.has(patch.username)) throw new HttpError(409, "that username is reserved");
  if (patch.username) {
    const taken = await db()!.user.findFirst({ where: { username: patch.username, NOT: { id: user.id } }, select: { id: true } });
    if (taken) throw new HttpError(409, "that username is taken");
  }
  await db()!.user.update({ where: { id: user.id }, data: patch });
  return json({ ok: true });
});
