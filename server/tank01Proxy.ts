import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";

const TANK01_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const TANK01_TIMEOUT_MS = 15_000;
const ALLOWED_ENDPOINTS = new Set([
  "getNFLPlayerInfo",
  "getNFLTeams",
  "getNFLGamesForWeek",
  "getNFLProjections",
  "getNFLBoxScore",
  "getNFLTeamSchedule",
  "getNFLGamesForPlayer",
  "getNFLADP",
  "getNFLNews",
  "getNFLDepthCharts",
]);

// Server-side response cache, keyed by endpoint+params. Sits in front of
// every Tank01 call regardless of which client hook/page issued it, or
// whether that client is running the latest polling fixes -- a genuine
// chokepoint fix rather than relying on every open browser tab across
// every owner having reloaded with the newest client-side code. Directly
// caps upstream call volume even if many overlapping/duplicate client
// requests arrive for the same endpoint+params within the TTL window
// (e.g. many owners' tabs all requesting the same live game's box score
// at once). 20s is deliberately just under the 30s client poll interval,
// so legitimate polling still gets reasonably fresh data while
// overlapping/duplicate requests within that window share one response.
// Per-endpoint cache TTL. Live game data has to stay near-real-time, so it
// keeps the original 20s window (just under the 30s client poll). But the
// slow-changing feeds were being re-fetched on that same 20s window even
// though they barely change and are identical for every viewer -- pure waste
// on a game-day Sunday with all 12 owners watching. Giving those a much longer
// TTL collapses "N viewers x every load" into ONE upstream call per window:
//   - news every 15 min (fresh enough for injury/inactive updates, but no
//     longer re-fetched per browser -- getNFLNews is a league-wide feed,
//     the same payload for everyone),
//   - player info (bio/photo/season stats behind the avatars) every 15 min --
//     this was the single biggest driver of the weekend spikes,
//   - near-static reference data (teams, ADP, depth charts, schedules) only a
//     few times a day.
// Anything not listed falls back to the safe 20s default.
const DEFAULT_CACHE_TTL_MS = 20_000;
const MINUTE_MS = 60_000;
const CACHE_TTL_BY_ENDPOINT: Record<string, number> = {
  getNFLBoxScore: 20_000,             // live in-game scoring -- must stay fresh
  getNFLGamesForWeek: 20_000,         // live game status + kickoff-lock checks
  getNFLNews: 15 * MINUTE_MS,         // league-wide news feed (same for all viewers)
  getNFLPlayerInfo: 15 * MINUTE_MS,   // player bio/photo/season stats (avatars)
  getNFLGamesForPlayer: 15 * MINUTE_MS,
  getNFLProjections: 60 * MINUTE_MS,
  getNFLTeamSchedule: 6 * 60 * MINUTE_MS,
  getNFLTeams: 6 * 60 * MINUTE_MS,
  getNFLADP: 6 * 60 * MINUTE_MS,
  getNFLDepthCharts: 6 * 60 * MINUTE_MS,
};
// The two live endpoints keep their 20s TTL only while a game could actually be
// in progress. Outside NFL game windows the weekly schedule and the (now-final)
// box scores are static, so a 20s TTL just re-fetches identical data on every
// page load and Live Scoring open -- the bulk of the quiet-day API spend. The
// window is intentionally generous so live scoring is never under-cached.
const LIVE_ENDPOINTS = new Set(["getNFLBoxScore", "getNFLGamesForWeek"]);
const OFF_WINDOW_TTL_MS = 15 * MINUTE_MS;
const ET_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Whether an NFL game could plausibly be in progress right now, in ET (so it
 * follows the EST/EDT shift on its own): roughly 9am to 2am on any day that has
 * a slate, which covers a 9:30am London kickoff through a night game in
 * overtime.
 *
 * The 12am-2am hours are attributed to the PREVIOUS day's slate -- a Monday
 * night game in overtime is still Monday football at 12:30am Tuesday -- because
 * otherwise the day rolling over to Tuesday would drop a live late game out of
 * the window and leave Live Scoring up to 15 minutes stale during the fourth
 * quarter. Same for a Thursday nighter running into Friday.
 *
 * Tue/Wed slates are treated as impossible. The league does occasionally move a
 * game there (weather, scheduling emergencies); the cost if that happens is
 * 15-minute-stale scores for that one game, not a broken page.
 */
export function isLiveGameWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value ?? "";
  let hour = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  if (hour >= 24) hour = 0; // some runtimes emit "24" for midnight

  if (hour >= 2 && hour < 9) return false; // overnight: nothing can be in progress
  const dayIndex = ET_DAYS.indexOf(weekday as (typeof ET_DAYS)[number]);
  if (dayIndex < 0) return true; // unparseable weekday: fail toward fresh data
  const slateDay = hour < 2 ? ET_DAYS[(dayIndex + 6) % 7] : ET_DAYS[dayIndex];
  return slateDay !== "Tue" && slateDay !== "Wed";
}

function cacheTtlMs(endpoint: string, now: Date = new Date()): number {
  if (LIVE_ENDPOINTS.has(endpoint) && !isLiveGameWindow(now)) return OFF_WINDOW_TTL_MS;
  return CACHE_TTL_BY_ENDPOINT[endpoint] ?? DEFAULT_CACHE_TTL_MS;
}
const responseCache = new Map<string, { ts: number; status: number; contentType: string; body: string }>();

// Shared L2 cache in Supabase, so the 20s dedup window actually holds
// across serverless instances and viewers -- the in-memory Map above is
// per-instance, and on Vercel each request can hit a different, short-
// lived instance, so it does NOT collapse many owners' overlapping polls
// the way a single shared cache does. Every read/write is best-effort:
// any error (including the table not existing yet) falls through to a
// normal upstream fetch, so a cache problem can never break live scoring.
// Run supabase_tank01_cache_table.sql to create the table.
const SHARED_CACHE_TABLE = "tank01_response_cache";

async function readSharedCache(cacheKey: string, ttlMs: number): Promise<{ status: number; contentType: string; body: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(SHARED_CACHE_TABLE)
      .select("status, content_type, body, updated_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (Date.now() - new Date(data.updated_at as string).getTime() >= ttlMs) return null;
    return { status: data.status as number, contentType: data.content_type as string, body: data.body as string };
  } catch {
    return null;
  }
}

async function writeSharedCache(cacheKey: string, status: number, contentType: string, body: string): Promise<void> {
  try {
    await supabaseAdmin
      .from(SHARED_CACHE_TABLE)
      .upsert({ cache_key: cacheKey, status, content_type: contentType, body, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch {
    // best-effort
  }
}

/** Test-only: clears the module-level response cache so test cases using
 * the same endpoint+params don't leak cached responses into each other. */
export function __clearTank01ProxyCacheForTests(): void {
  responseCache.clear();
}

// Emergency kill switch for the two endpoints most implicated in the
// runaway-usage investigation earlier tonight (getNFLBoxScore,
// getNFLGamesForWeek). INACTIVE BY DEFAULT -- normal live scoring works
// as usual. Kept available as a quick, env-var-toggleable emergency tool
// (no code deploy needed to flip it, beyond this one that adds the
// mechanism) in case it's ever needed again, rather than removing it
// outright.
//
// Deliberately returns a 503 rather than an empty-but-successful
// response when active: getNFLGamesForWeek also backs the rivalry-game
// and free-agent kickoff-lock checks built earlier tonight, both of
// which already treat a failed check as "assume locked" specifically to
// fail safe -- an empty 200 response would instead read as "no games
// found, nothing has started," silently failing those checks open (the
// wrong direction). A 503 lets that existing fail-safe logic do its job
// correctly.
//
// To turn ON (emergency use only): set TANK01_KILL_SWITCH=on in the
// environment and redeploy (or however this platform applies env var
// changes). Leaving it unset, or any value other than "on", keeps it off.
const KILL_SWITCH_ENDPOINTS = new Set(["getNFLBoxScore", "getNFLGamesForWeek"]);
function isKillSwitchActive(): boolean {
  return process.env.TANK01_KILL_SWITCH === "on";
}

/**
 * Proxies the small allowlist of Tank01 endpoints required by WRC. The browser
 * can choose only an approved endpoint and scalar query parameters; the RapidAPI
 * credential remains solely in the server environment.
 */
export async function proxyTank01Request(req: Request, res: Response) {
  const endpoint = req.params.endpoint;
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    res.status(404).json({ error: "Unknown Tank01 endpoint" });
    return;
  }

  if (KILL_SWITCH_ENDPOINTS.has(endpoint) && isKillSwitchActive()) {
    res.status(503).json({ error: "Live scoring is temporarily disabled." });
    return;
  }

  const apiKey = process.env.TANK01_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Tank01 data is unavailable" });
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string" && key.length <= 64 && value.length <= 256) query.set(key, value);
  }

  const ttlMs = cacheTtlMs(endpoint);
  const cacheKey = `${endpoint}?${query.toString()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttlMs) {
    res.status(cached.status).type(cached.contentType).send(cached.body);
    return;
  }

  // L2: shared across instances/viewers. Warm this instance's L1 from it
  // so subsequent same-instance requests skip the Supabase round trip.
  const shared = await readSharedCache(cacheKey, ttlMs);
  if (shared) {
    responseCache.set(cacheKey, { ts: Date.now(), status: shared.status, contentType: shared.contentType, body: shared.body });
    res.status(shared.status).type(shared.contentType).send(shared.body);
    return;
  }

  try {
    const upstream = await fetch(`https://${TANK01_HOST}/${endpoint}?${query.toString()}`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": TANK01_HOST },
      signal: AbortSignal.timeout(TANK01_TIMEOUT_MS),
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();
    if (upstream.ok) {
      responseCache.set(cacheKey, { ts: Date.now(), status: upstream.status, contentType, body });
      await writeSharedCache(cacheKey, upstream.status, contentType, body);
    }
    res.status(upstream.status).type(contentType).send(body);
  } catch (error) {
    console.error("Tank01 proxy request failed", error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Tank01 data request timed out" : "Tank01 data is temporarily unavailable" });
  }
}
