# clack.

**How fast are your thoughts?** A typing playground built to feel alive: a caret with manners, ten atmospheres, replayable runs, and deep analytics. You don't need to sign up to start.

- **Typing:** time, words, quotes, code (with syntax highlighting), zen, custom text, flow, accuracy mode, and a ghost caret that races your personal best.
- **Results:** a staged reveal, a WPM/raw/error graph, algorithmic insights, and a per-key heatmap and share cards for every test.
- **History:** a calendar explorer with filters, a full replay of any run, and a Rhythm Map of every keystroke.
- **Stats:** distributions, time-of-day, weekday and duration charts, rolling averages and a keyboard heatmap.
- **Records:** one PB per category, each with its progression over time.
- **Practice:** adaptive training built around your weakest letter pairs, drills, and a custom test builder that creates shareable challenge links.
- **Daily challenge:** the same text for everyone every day, one official attempt, streaks and a leaderboard.
- **Everywhere:** a command palette (`Ctrl/⌘ K`), keyboard-first navigation, 6 synthesized sound packs, accessibility modes, and a few undocumented surprises.

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, Motion, Recharts, cmdk, Zustand, Prisma 7 + PostgreSQL, Clerk, Vitest and Playwright.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables set, clack. runs in **local-only mode**: everything works, and history is stored in the browser.

## Deploy (Vercel or Netlify)

1. **Push this repo** and import it in Vercel ("Add New → Project") or Netlify ("Add new site → Import"). Both detect Next.js automatically. `vercel.json` and `netlify.toml` are included.
2. That's enough for a working anonymous deployment. To enable accounts and sync, add these environment variables:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Any Postgres, e.g. [Neon](https://neon.tech) (free tier). Use the **direct** (non-pooled) connection string. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk dashboard](https://dashboard.clerk.com) → API keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API keys |

3. **Redeploy.** The build (`npm run build`) runs `prisma generate`, applies migrations with `prisma migrate deploy` when `DATABASE_URL` is set, then runs `next build`. Set `SKIP_MIGRATIONS=1` to skip migrations, e.g. for preview deployments that share a database.

The app turns features on based on what's configured:

| Configured | What you get |
| --- | --- |
| nothing | Anonymous, browser-only history. Sign-in buttons are hidden. |
| database + Clerk | Accounts, server-verified results, sync across devices, importing local history, daily leaderboard, profiles |

See `.env.example` for all options.

## How results are trusted

Results are never taken from the client. Every test uploads its **keystroke log**: a key string, millisecond deltas and the end time. The server then:

1. rebuilds the exact text from the test's seed (or quote/snippet id),
2. replays the keystrokes through the same engine the browser uses, and computes every number itself,
3. runs anti-cheat checks: impossible WPM, injected bursts, robotic rhythm, a timeline or duration that doesn't match, and runs that never finished.

Flagged runs stay in your personal history but are excluded from records and leaderboards. API routes validate every input with zod, apply rate limits, and require authentication for writes.

## Architecture

```
src/engine/       framework-free typing engine, metrics, replay, anti-cheat, insights
src/content/      word lists (language packs), public-domain quotes, code snippets, highlighter
src/components/   typing surface (imperative DOM renderer), results, charts, replay, palette
src/stores/       settings, history (local + remote), UI state
src/server/       db, auth, validation, rate limits, test verification
src/app/          routes + API
prisma/           schema + migrations (includes models for races, friends, goals…)
```

**Performance.** The typing surface is rendered once by React. After that, each keystroke updates only the letter spans that changed, through direct DOM class diffs, and moves the caret with a transform. No React re-renders happen while you type. Live stats refresh at 10 Hz by writing directly to the DOM, and charts are lazy-loaded.

**Adding a language:** create `src/content/languages/<id>.ts` exporting a `LanguagePack`, then register it in `src/content/languages/index.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / server |
| `npm test` | unit tests (engine, metrics, content, anti-cheat) |
| `npm run test:e2e` | Playwright end-to-end tests, run after `npm run build` |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run fixtures` | print a realistic simulated history (JSON) for previews |

## Roadmap

- Real-time races: the schema has `Race` and `RaceParticipant`. What's left is plugging in a realtime host such as PartyKit, Liveblocks, or a small WebSocket server.
- Friends and public leaderboards UI: `GET /api/leaderboard` is ready.
