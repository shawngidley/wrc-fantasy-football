import { supabaseAdmin } from "./supabaseAdmin";

const API_BASE = "https://api.fantasypros.com/public/v2/json";

// Confirmed directly with FantasyPros support (Sept 2026): this key is on
// the Premium plan -- 1 request/sec, burst of 4, 500 requests/day. Shared
// with the CVC football site, which no longer calls FantasyPros directly
// -- it reads the same cache through /api/fantasypros/feed instead. This
// module is the ONLY code in either app that calls api.fantasypros.com.
const DAILY_CALL_CAP = 480;
const MIN_CALL_SPACING_MS = 300; // keeps consecutive calls under the 1/sec, burst-of-4 limit

/**
 * News and injuries are the two endpoints that matter on a sub-hour
 * cadence -- a late-breaking inactive or an in-game injury update is
 * exactly the kind of thing a long TTL misses right when it matters most.
 * NFL games run Thu/Sun/Mon, so the short cadence only applies during a
 * fraction of the week. Checked in US Eastern time, since that's what NFL
 * kickoff times are set against regardless of the server's own (UTC) clock.
 *
 * Window is intentionally generous (covers the full slate from early
 * afternoon games through Monday/Sunday/Thursday night games, plus an early
 * buffer for inactives, which are typically announced ~90 min before
 * kickoff) rather than trying to pin down exact per-game windows.
 */
export function isLikelyNflGameWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? -1);

  if (weekday === "Sun") return hour >= 11 && hour <= 23; // early inactives through SNF
  if (weekday === "Thu") return hour >= 18 && hour <= 23; // TNF window
  if (weekday === "Mon") return hour >= 18 && hour <= 23; // MNF window
  return false;
}

export function newsThresholdMs(inGameWindow: boolean): number {
  return inGameWindow ? 15 * 60_000 : 30 * 60_000;
}

export function injuriesThresholdMs(inGameWindow: boolean): number {
  return inGameWindow ? 15 * 60_000 : 2 * 60 * 60_000;
}

export const RANKINGS_PROJECTIONS_THRESHOLD_MS = 8 * 60 * 60_000;

/** Cache keys shared with the read side (fantasypros.ts) so both agree on where a dataset lives. */
export const CACHE_KEYS = {
  news: (): string => "news",
  injuries: (season: number, week: number): string => `injuries:${season}:week:${week}`,
  ranks: (position: string, week: number): string => `ranks:${position}:week:${week}`,
  projections: (position: string, week: number): string => `projections:${position}:week:${week}`,
};

/** A row is due for refresh if it's missing, or its fetched_at is older than the threshold. Pure -- no network. */
export function isDue(fetchedAt: string | null | undefined, thresholdMs: number, now = Date.now()): boolean {
  if (!fetchedAt) return true;
  const fetchedMs = new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedMs)) return true;
  return now - fetchedMs >= thresholdMs;
}

export type FantasyProsDatasetKind = "news" | "injuries" | "ranks" | "projections";

/**
 * Budget priority, independent of whether a dataset is otherwise due:
 * at 480+ calls today, only injuries during a live game window are worth
 * the remaining headroom; at 450+, rankings/projections (which tolerate
 * staleness far better than news/injuries) pause first. Pure -- no network.
 */
export function shouldSkipForBudget(kind: FantasyProsDatasetKind, callsToday: number, inGameWindow: boolean): { skip: boolean; reason?: string } {
  if (callsToday >= DAILY_CALL_CAP) {
    if (kind === "injuries" && inGameWindow) return { skip: false };
    return { skip: true, reason: `budget at ${callsToday}/500 -- only injuries-in-game-window run at or above ${DAILY_CALL_CAP}` };
  }
  if (callsToday >= 450 && (kind === "ranks" || kind === "projections")) {
    return { skip: true, reason: `budget at ${callsToday}/500 -- rankings/projections pause at 450+` };
  }
  return { skip: false };
}

export const CIRCUIT_BREAKER_PAUSE_MS = 60 * 60_000;

/**
 * Sentinel `day` value for the circuit breaker's pause state. Stored as a
 * row in the same fantasypros_usage table (day/calls/notes) rather than a
 * dedicated table -- it never collides with a real nyDateString() value, so
 * it can't be mistaken for a day's call count.
 */
export const CIRCUIT_BREAKER_ROW_KEY = "circuit-breaker";

/** Pure: is the circuit breaker currently open (should this tick do nothing)? */
export function isCircuitBreakerPaused(pausedUntil: string | null | undefined, now = Date.now()): boolean {
  if (!pausedUntil) return false;
  const pausedUntilMs = new Date(pausedUntil).getTime();
  if (!Number.isFinite(pausedUntilMs)) return false;
  return now < pausedUntilMs;
}

export interface CircuitBreakerTickOutcome {
  hadSuccess: boolean;
  hadRateLimited: boolean;
}

/**
 * Decide the circuit breaker's next paused-until value from how a tick
 * went. A success proves FantasyPros is reachable again and clears the
 * pause, even if the same tick also hit a 429 earlier (a 429 followed by a
 * success within one tick means the outage already ended). A tick with a
 * 429 and zero successes opens (or extends) the pause by
 * CIRCUIT_BREAKER_PAUSE_MS. A tick with neither (nothing due, everything
 * budget-skipped) leaves the existing state untouched. Pure -- no network.
 */
export function nextCircuitBreakerPausedUntil(
  current: string | null,
  outcome: CircuitBreakerTickOutcome,
  now = Date.now(),
): string | null {
  if (outcome.hadSuccess) return null;
  if (outcome.hadRateLimited) return new Date(now + CIRCUIT_BREAKER_PAUSE_MS).toISOString();
  return current;
}

/** "Day" for the usage counter is the America/New_York calendar day, per FantasyPros' own billing clock. */
export function nyDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

async function readTodayUsage(day: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from("fantasypros_usage").select("calls").eq("day", day).maybeSingle();
  if (error) throw new Error(`Unable to read FantasyPros usage: ${error.message}`);
  return data?.calls ?? 0;
}

/** Atomic upsert-and-return via a Postgres function, so two overlapping invocations can't undercount each other's calls. */
async function incrementUsage(day: string, note?: Record<string, unknown>): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("fantasypros_usage_increment", { p_day: day, p_note: note ?? null });
  if (error) throw new Error(`Unable to increment FantasyPros usage: ${error.message}`);
  return data as number;
}

let lastCallAt = 0;
async function respectRateLimit(): Promise<void> {
  const wait = lastCallAt + MIN_CALL_SPACING_MS - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

export type FetchAndStoreStatus = "fetched" | "skipped-budget" | "rate-limited";
export interface FetchAndStoreResult {
  key: string;
  status: FetchAndStoreStatus;
  reason?: string;
}

/**
 * The only function in either app that calls api.fantasypros.com. Checks
 * today's usage counter first and refuses outright above the daily cap
 * (no network call at all -- that's the only way to guarantee the cap
 * holds). On success, upserts fantasypros_cache and increments the
 * counter. On 429, logs the path and any rate-limit headers FantasyPros
 * sent back, increments the counter (the call still happened from
 * FantasyPros' point of view), and does not retry.
 */
export async function fetchAndStore(key: string, path: string, ttlMs: number): Promise<FetchAndStoreResult> {
  const day = nyDateString();
  const callsToday = await readTodayUsage(day);
  if (callsToday >= DAILY_CALL_CAP) {
    const reason = `daily cap reached (${callsToday}/500)`;
    console.warn(`[fantasypros-fetcher] skipping ${key}: ${reason}`);
    return { key, status: "skipped-budget", reason };
  }

  const apiKey = process.env.FANTASYPROS_API_KEY;
  if (!apiKey) throw new Error("FantasyPros API is not configured");

  await respectRateLimit();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    const rateLimitHeaders = Object.fromEntries(
      Array.from(response.headers.entries()).filter(([headerKey]) => /rate.?limit|retry.?after/i.test(headerKey)),
    );
    console.error(`[fantasypros-fetcher] 429 on ${path}`, Object.keys(rateLimitHeaders).length ? rateLimitHeaders : "(no rate-limit headers present in response)");
    await incrementUsage(day, { key, path, status: 429, headers: rateLimitHeaders });
    return { key, status: "rate-limited", reason: "429" };
  }
  if (!response.ok) {
    await incrementUsage(day, { key, path, status: response.status });
    throw new Error(`FantasyPros request failed with status ${response.status} for ${path}`);
  }

  const payload = await response.json();
  const now = new Date();
  const { error: upsertError } = await supabaseAdmin.from("fantasypros_cache").upsert({
    key,
    payload,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
  }, { onConflict: "key" });
  if (upsertError) throw new Error(`Unable to store FantasyPros cache for ${key}: ${upsertError.message}`);

  await incrementUsage(day);
  return { key, status: "fetched" };
}
