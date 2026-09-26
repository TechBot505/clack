import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL is optional: without it the app runs in local-only mode.
// `prisma generate` works without a URL; migrations need one.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/clack",
  },
});
