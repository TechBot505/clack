import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseEnabled } from "./env";

type Client = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { __clackPrisma?: Client };

/** Lazily created Prisma client; null when DATABASE_URL isn't configured. */
export function db(): Client | null {
  if (!databaseEnabled) return null;
  if (!globalForPrisma.__clackPrisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5 });
    globalForPrisma.__clackPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__clackPrisma;
}

export type Db = Client;
