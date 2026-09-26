import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { clerkEnabled } from "./env";
import { db } from "./db";
import { HttpError } from "./http";

export interface AuthedUser {
  id: string;
  clerkId: string;
}

/** The signed-in user's DB row (created on first sight), or null. */
export async function getUser(): Promise<AuthedUser | null> {
  const dev = await devUser();
  if (dev !== undefined) return dev;
  if (!clerkEnabled) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const prisma = db();
  if (!prisma) return null;
  const existing = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, clerkId: true } });
  if (existing) return existing;
  const cu = await currentUser().catch(() => null);
  return prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: {
      clerkId: userId,
      displayName: cu?.firstName ?? cu?.username ?? null,
      avatarUrl: cu?.imageUrl ?? null,
    },
    select: { id: true, clerkId: true },
  });
}

export async function requireUser(): Promise<AuthedUser> {
  if (!db()) throw new HttpError(503, "database not configured");
  const u = await getUser();
  if (!u) throw new HttpError(401, "sign in required");
  return u;
}

/**
 * Local/integration testing only: with CLACK_DEV_AUTH=1 in a non-production
 * build, the `x-clack-dev-user` header acts as a signed-in user. It can never
 * activate in production builds.
 */
async function devUser(): Promise<AuthedUser | null | undefined> {
  if (process.env.NODE_ENV === "production" || process.env.CLACK_DEV_AUTH !== "1") return undefined;
  const id = (await headers()).get("x-clack-dev-user");
  if (!id) return undefined;
  const prisma = db();
  if (!prisma) return null;
  const clerkId = `dev_${id.replace(/[^a-z0-9_-]/gi, "").slice(0, 32)}`;
  return prisma.user.upsert({ where: { clerkId }, update: {}, create: { clerkId, displayName: id }, select: { id: true, clerkId: true } });
}
