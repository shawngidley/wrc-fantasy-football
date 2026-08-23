# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A private fantasy football league site for the "WRC" league (12 teams: draft, keeper protections, waivers/FAAB, trades, lineups, live scoring, standings, money/payouts). Full-stack TypeScript: React 19 (Vite) client + Express server, communicating over a single tRPC router. Deployed on Vercel; all persistent data lives in Supabase (Postgres + Storage).

The project started from a generic "web app template" originally hosted on Manus; that platform-specific layer (OAuth login, MySQL/Drizzle `users` table, a Forge-backed file-storage proxy, Manus's own cron/task identity) has been fully removed. The root `README.md` still describes that original template and is stale — don't treat it as current.

## Commands

```
pnpm dev            # tsx watch server/_core/index.ts — dev server (Vite middleware + Express + tRPC), NODE_ENV=development
pnpm build          # vite build (client) + esbuild bundle of server/_core/index.ts -> dist/index.js, for `pnpm start` (non-Vercel hosting)
pnpm build:client   # vite build only — this is what Vercel's buildCommand runs (see vercel.json)
pnpm build:api      # esbuild-bundles server/_core/vercelEntry.ts -> api/index.js — MUST be re-run and committed after any change to server/ or shared/ code (see "Deploying to Vercel" below)
pnpm start          # NODE_ENV=production node dist/index.js
pnpm check          # tsc --noEmit
pnpm format         # prettier --write .
pnpm test           # vitest run
```

Run a single test file: `pnpm vitest run path/to/file.test.ts`. Run by name: `pnpm vitest run -t "test name"`.

Test files ending in `.secret.test.ts` (`server/fantasypros.secret.test.ts`, `server/tank01.secret.test.ts`) and `server/fantasypros.test.ts` assert against live provider API keys (`TANK01_API_KEY`, `FANTASYPROS_API_KEY`) — they fail in any environment without those secrets configured, not because of a code bug.

## Architecture

### Everything server-side goes through Supabase

All league data — teams, players/rosters, lineups, draft state, draft queue, protections, watchlist, trade proposals, FAAB bids, standings, weekly results, earnings, and the FantasyPros/season-stats caches — lives in **Supabase Postgres**, accessed exclusively server-side through the service-role client `server/supabaseAdmin.ts` (`supabaseAdmin`, needs `SUPABASE_SERVICE_ROLE_KEY`). That client is a lazy `Proxy` — constructing it (and thus requiring the env var) only happens on first actual use, so importing a module that pulls it in transitively doesn't itself require the secret (keeps pure-logic unit tests runnable without credentials).

Owner/commissioner identity is a signed httpOnly JWT cookie (`server/wrcTeamSession.ts`, `wrc_team_session`, signed with `JWT_SECRET`), set after PIN verification (`server/leagueAuth.ts`, `server/leagueLoginSecurity.ts`) or WebAuthn/passkey sign-in (`server/passkeyAuth.ts`, origin-locked to `wrcfantasyfootball.com`). This maps to tRPC's `teamProcedure` (any signed-in team) and `commissionerProcedure` (session must belong to the commissioner team) in `server/_core/trpc.ts`. There is no other auth system — the old platform OAuth/`protectedProcedure`/`adminProcedure` stack is gone.

File storage (owner-uploaded team logos/theme songs, and static site assets — backgrounds, the WRC logo, the draft chime) is **Supabase Storage**: `server/storage.ts` uploads to the `team-media` bucket; the client builds public URLs for the `site-assets` bucket via `client/src/lib/siteAssetUrl.ts`. RLS is being rolled out incrementally on the Postgres tables (see `SUPABASE_RLS_ROLLOUT.md`, `SUPABASE_RLS_CUTOVER_GUIDE.md`, `SUPABASE_RLS_POST_CUTOVER_VERIFICATION.md`) — any browser-facing read/write of league data must go through a server tRPC procedure that derives the acting team from the signed session, never a client-supplied team ID, and no new direct-from-browser Supabase table access should be added.

### tRPC router

Single router tree in `server/routers.ts` (large file — grep for the sub-router key, e.g. `league:`, rather than reading it end-to-end). Top-level namespaces: `system` (just a `health` check, `server/_core/systemRouter.ts`) and `league` (everything else — teams, login/passkeys, lineups, draft queue, watchlist, FAAB, protections, trades, draft admin, weekly results, etc.), plus `fantasyPros`. The client consumes it via `client/src/lib/trpc.ts` (`createTRPCReact<AppRouter>()`), transformer is `superjson`.

### Scheduled/cron endpoints

Plain `GET` routes registered in `server/_core/app.ts` under `/api/scheduled/*` (season stats refresh, FantasyPros archive collection, post-deadline protection release, weekly results finalize), gated by a `requireCronSecret` middleware that checks `Authorization: Bearer $CRON_SECRET`. Triggered by Vercel Cron (`vercel.json`'s `crons` array, currently daily — Vercel Cron only sends GET). The corresponding logic lives in `server/scheduled*.ts` and the underlying `server/*Finalize.ts` / `*Refresh.ts` / `*Archive.ts` modules. Weekly results finalization (`server/weeklyResultsFinalize.ts`) only finalizes a week once all of that week's NFL games are confirmed final, and recomputes standings/league median server-side — there is intentionally no browser- or commissioner-triggered scoring control.

### External data providers

- **FantasyPros** (`server/fantasypros.ts`, `fantasyprosArchive.ts`, `fantasyprosNewsNames.ts`) — rankings, projections, injuries, news; archived into Supabase's `fantasypros_news_archive`/`fantasypros_news_archive_config` tables over time.
- **Tank01** (`server/tank01Proxy.ts`) — NFL live scores/stats, proxied through `/api/tank01/:endpoint` so the API key never reaches the browser.
- **ESPN** — used client-side for kicker live-scoring events only; see `ESPN_LIVE_KICKER_SOURCE.md`.
- Season-stats snapshot caching (`server/seasonStatsSnapshot.ts`, `seasonStatsRefresh.ts`) persists to Supabase's `wrc_season_stats_cache` table; see `supabase_cache_tables.sql` for the schema of all three cache tables.

Client hooks in `client/src/hooks/useNFL*.ts`, `useESPNSeasonStats.ts`, `useTank01Player.ts` wrap these.

### Draft/keeper domain model

Draft player universe and 2026 draft data are static/generated datasets (`shared/draftPlayerUniverse.ts`, `shared/currentDraftPlayerUniverse2026.ts`, `client/src/lib/draftData2026.ts`) validated against on submission (e.g. draft queue adds must resolve via `findDraftUniversePlayer`). Keeper "protections" have round-forfeit rules validated in `server/protectionRules.ts` against a fixed deadline (`shared/protectionSchedule.ts`); once the deadline passes, unprotected players are released (`server/protectionRelease.ts`). Trade proposals can bundle players, FAAB, and draft picks (including future-year traded picks) and are validated for ownership/availability on both propose and accept.

### Path aliases

`@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets` (see `vite.config.ts` / `vitest.config.ts`) — these work for client code because Vite's bundler resolves them. **Server-side code must NOT use `@shared/*`** even though `tsconfig.json` declares the path: Vercel's Node function builder does a per-file TypeScript transpile that does not rewrite tsconfig `paths`, so a bare `@shared/...` import compiles fine locally (`tsc`/`vitest`) but crashes at runtime on Vercel with `ERR_MODULE_NOT_FOUND`. Use a relative import (`../shared/...`) from anything under `server/` instead.

### Deploying to Vercel

The deployed API is a **single pre-bundled serverless function**, not the raw TypeScript source:

- `server/_core/app.ts` exports `createApp()` — the Express app (CSP/security headers, body parsers, the plain `/api/*` routes, the tRPC mount). It contains no `app.listen()` and no Vite/static-file serving.
- `server/_core/index.ts` is the **local dev/`pnpm start` entry point only** — it calls `createApp()` and adds `server.listen()` plus the dev-mode Vite middleware / prod-mode static-file serving (`server/_core/vite.ts`). This is never used on Vercel.
- `server/_core/vercelEntry.ts` (`export default createApp();`) is bundled by esbuild into **`api/index.js`** — a single, fully self-contained CommonJS file (`pnpm run build:api`) with every dependency inlined (no `node_modules` needed at runtime). `api/package.json` (`{"type":"commonjs"}`) overrides the root `"type":"module"` so Node loads it as CJS.
- **`api/index.js` (and its `.map`) are committed to git**, not generated by Vercel's `buildCommand`. This was a deliberate, verified-necessary choice: Vercel's zero-config `/api` function discovery scans the checked-out source tree *before* `buildCommand` runs, so a build-time-generated function file is never found. It also has to be a full bundle rather than plain TS/`--packages=external`: Vercel's own per-file TS transpile doesn't rewrite relative imports or tsconfig path aliases correctly for this project shape, and even with correct imports, tracing `node_modules` for deployment from this pnpm-on-Windows dev setup produced broken package symlinks at runtime (`Cannot find package '@supabase/supabase-js'`) — fully bundling sidesteps both failure modes.
- **Whenever you change anything under `server/` or `shared/`, you must run `pnpm run build:api` again and commit the resulting `api/index.js`/`api/index.js.map`** before deploying — the deployed function is only as current as that committed bundle, not the live TS source.
- `vercel.json`: `buildCommand` only runs `pnpm run build:client` (the static site); `outputDirectory: dist/public`; `rewrites` sends `/api/(.*)` to the bundled function and everything else to `/index.html` (SPA fallback); a `headers` block re-applies the CSP/security headers to CDN-served static files, since those bypass `createApp()`'s Express middleware entirely; `crons` triggers the four scheduled endpoints.
- Verified working end-to-end (2026-08-22): `vercel build` + `vercel deploy --prebuilt --prod` from this machine; confirmed via direct `curl` against the deployed function (`system.health` → 200, `league.teams` → clean "SUPABASE_SERVICE_ROLE_KEY is not configured" error rather than a crash, confirming the lazy-Proxy pattern in `supabaseAdmin.ts` degrades gracefully) and against the static site (correct title, correct CSP header present).
- Required env vars (`vercel env add <NAME>`, never commit these): `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `TANK01_API_KEY`, `FANTASYPROS_API_KEY`, `CRON_SECRET`.

### `scripts/`

One-off/offline data loading and migration scripts (`.mjs`/`.py`) for seeding Supabase tables or building static season-stat datasets. Not part of the running app — run manually, not from `package.json`.
