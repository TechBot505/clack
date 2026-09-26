/**
 * Feature flags derived from environment variables. The app degrades
 * gracefully: no Clerk keys → anonymous-only; no DATABASE_URL → local-only.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
export const databaseEnabled = Boolean(process.env.DATABASE_URL);
