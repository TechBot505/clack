import { z } from "zod";
import { handler, json, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// Settings are a flat bag of primitives plus the last test config. Keep it
// permissive (clients merge with defaults) but bounded in size and shape.
const scalar = z.union([z.string().max(5200), z.number(), z.boolean(), z.null()]);
const primitive = z.union([scalar, z.array(z.string().max(40)).max(50), z.array(z.record(z.string().max(40), scalar)).max(20)]);
const settingsSchema = z.object({
  settings: z.record(z.string().max(40), z.union([primitive, z.record(z.string().max(40), primitive)])),
});

export const GET = handler(async () => {
  const user = await requireUser();
  rateLimit(`read:${user.id}`, LIMITS.read);
  const row = await db()!.userSettings.findUnique({ where: { userId: user.id } });
  return json({ settings: row?.data ?? null });
});

export const PUT = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`write:${user.id}`, LIMITS.write);
  const { settings } = await parseBody(req, settingsSchema, 32_000);
  const data = settings as Prisma.InputJsonValue;
  await db()!.userSettings.upsert({ where: { userId: user.id }, update: { data }, create: { userId: user.id, data } });
  return json({ ok: true });
});
