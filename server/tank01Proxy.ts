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
const CACHE_TTL_MS = 20_000;
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

async function readSharedCache(cacheKey: string): Promise<{ status: number; contentType: string; body: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(SHARED_CACHE_TABLE)
      .select("status, content_type, body, updated_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (Date.now() - new Date(data.updated_at as string).getTime() >= CACHE_TTL_MS) return null;
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

  const cacheKey = `${endpoint}?${query.toString()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.status(cached.status).type(cached.contentType).send(cached.body);
    return;
  }

  // L2: shared across instances/viewers. Warm this instance's L1 from it
  // so subsequent same-instance requests skip the Supabase round trip.
  const shared = await readSharedCache(cacheKey);
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
