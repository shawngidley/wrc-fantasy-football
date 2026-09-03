import { TRPCError } from "@trpc/server";

const API_BASE = "https://api.fantasypros.com/public/v2/json";

type CacheEntry<T> = { expiresAt: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

export type FantasyProsNewsItem = {
  id: number;
  playerId: number | null;
  playerName: string;
  team: string;
  position?: string;
  title: string;
  description: string;
  impact: string;
  author: string;
  published: string;
  link: string;
  categories: string[];
};

export type FantasyProsInjury = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  status: string;
  shortStatus: string;
  injuryType: string;
  practiceInjuryType: string;
  comment: string;
  updated: string;
  probabilityOfPlaying: number | null;
  practices: string[];
};

export type FantasyProsRank = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  ecr: number | null;
  positionRank: string;
  tier: number | null;
  byeWeek: number | null;
};

export type FantasyProsProjection = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  points: number | null;
  pprPoints: number | null;
  passYards: number | null;
  passTouchdowns: number | null;
  interceptions: number | null;
  rushYards: number | null;
  rushTouchdowns: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function request<T>(path: string, cacheTtlMs: number): Promise<T> {
  const cacheKey = path;
  const existing = cache.get(cacheKey) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) return existing.value;

  const apiKey = process.env.FANTASYPROS_API_KEY;
  if (!apiKey) throw new Error("FantasyPros API is not configured");

  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    // On a paid tier, a bare 429 with no further detail isn't enough to
    // diagnose whether this is a total-volume quota, a burst/per-second
    // rate cap, or something else entirely -- capture whatever headers
    // FantasyPros actually sends back (common ones: Retry-After,
    // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) so
    // Vercel's function logs show the real limit being hit next time,
    // rather than needing to guess from the status code alone.
    if (response.status === 429) {
      const rateLimitHeaders = Object.fromEntries(
        Array.from(response.headers.entries()).filter(([key]) => /rate.?limit|retry.?after/i.test(key)),
      );
      console.error(`[fantasypros] 429 on ${path}`, Object.keys(rateLimitHeaders).length ? rateLimitHeaders : "(no rate-limit headers present in response)");
      // Surface this as an actual 429 rather than a generic 500 -- a plain
      // Error() thrown from a tRPC procedure defaults to a 500 Internal
      // Server Error, which is misleading here (nothing is actually broken
      // server-side) and was tripping Vercel's own 5xx anomaly monitoring,
      // flagging this as a suspected server-side issue rather than what it
      // actually is: an upstream rate limit being correctly reported.
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "FantasyPros request failed with status 429" });
    }
    throw new Error(`FantasyPros request failed with status ${response.status}`);
  }

  const value = (await response.json()) as T;
  cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs });
  return value;
}

// Confirmed directly with FantasyPros support (Sept 2026): this key is on
// the Premium plan -- 1 request/sec, burst of 4, 500 requests/day (5x the
// 100/day figure in the published Terms of Use, which is the free tier).
// The previous TTLs (15-60 min) were sized as if this were a much higher
// or unlimited budget and burned through the real 500/day allowance during
// active league usage. These are sized to comfortably stay well under that
// budget even on a busy day with all 12 owners active, while still keeping
// data reasonably fresh for a fantasy app (none of this needs to update on
// a sub-hour cadence except possibly right at kickoff, which live scoring
// -- a completely separate, Tank01-based data path -- already handles).
const RANKINGS_CACHE_TTL_MS = 4 * 60 * 60_000; // 4 hours -- changes even less often than news/injuries, and isn't time-sensitive during a game the way inactive/injury news is
const PROJECTIONS_CACHE_TTL_MS = 3 * 60 * 60_000; // 3 hours -- same reasoning as rankings

/**
 * News and injuries are the two endpoints that actually matter on a
 * sub-hour cadence -- a late-breaking inactive or an in-game injury update
 * is exactly the kind of thing a 2-4 hour TTL misses for way too long right
 * when it matters most. The 500/day budget has real room for this: NFL
 * games run Thu/Sun/Mon, so a short TTL only applies during a fraction of
 * the week. Checked in US Eastern time, since that's what NFL kickoff times
 * are set against regardless of the server's own (UTC) clock.
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

function newsAndInjuriesCacheTtlMs(): number {
  return isLikelyNflGameWindow() ? 15 * 60_000 : 2 * 60 * 60_000; // 15 min during games, 2 hours otherwise
}

export async function getFantasyProsNews(limit = 50, fpid?: number): Promise<FantasyProsNewsItem[]> {
  const query = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100)),
    order_by: "updated",
  });
  if (fpid != null) query.set("fpid", String(fpid));
  const data = asRecord(await request<unknown>(`/nfl/news?${query.toString()}`, newsAndInjuriesCacheTtlMs()));
  return asArray(data.items).map(item => {
    const row = asRecord(item);
    return {
      id: asNumber(row.id) ?? 0,
      playerId: asNumber(row.player_id),
      playerName: asString(row.player_name ?? row.name),
      team: asString(row.team_id),
      title: asString(row.title),
      description: asString(row.desc),
      impact: asString(row.impact),
      author: asString(row.author),
      published: asString(row.created),
      link: asString(row.link),
      categories: asArray(row.categories).map(asString).filter(Boolean),
    };
  }).filter(item => item.title);
}

export async function getFantasyProsInjuries(year: number, week: number): Promise<FantasyProsInjury[]> {
  const data = asRecord(await request<unknown>(
    `/nfl/injuries?year=${year}&week=${week}&include_probabilities=true`,
    newsAndInjuriesCacheTtlMs(),
  ));
  return asArray(data.injuries).map(item => {
    const row = asRecord(item);
    return {
      playerId: asNumber(row.player_id) ?? 0,
      name: asString(row.name),
      team: asString(row.team_id),
      position: asString(row.position_id),
      status: asString(row.status),
      shortStatus: asString(row.status_short),
      injuryType: asString(row.injury_type),
      practiceInjuryType: asString(row.practice_report_injury_type),
      comment: asString(row.comment),
      updated: asString(row.injury_update_date),
      probabilityOfPlaying: asNumber(row.probability_of_playing),
      practices: [asString(row.practice_1), asString(row.practice_2), asString(row.practice_3)].filter(Boolean),
    };
  }).filter(item => item.name && item.status);
}

export async function getFantasyProsRanks(position: string, week: number): Promise<FantasyProsRank[]> {
  const query = new URLSearchParams({ position, scoring: "PPR", type: week > 0 ? "WEEKLY" : "DRAFT", week: String(week) });
  const data = asRecord(await request<unknown>(`/nfl/2026/consensus-rankings?${query.toString()}`, RANKINGS_CACHE_TTL_MS));
  return asArray(data.players).map(item => {
    const row = asRecord(item);
    return {
      playerId: asNumber(row.player_id) ?? 0,
      name: asString(row.player_name),
      team: asString(row.player_team_id),
      position: asString(row.player_position_id),
      ecr: asNumber(row.rank_ecr),
      positionRank: asString(row.pos_rank),
      tier: asNumber(row.tier),
      byeWeek: asNumber(row.player_bye_week),
    };
  }).filter(item => item.name);
}

export async function getFantasyProsProjections(position: string, week: number): Promise<FantasyProsProjection[]> {
  const query = new URLSearchParams({ position, week: String(week) });
  const data = asRecord(await request<unknown>(`/nfl/2026/projections?${query.toString()}`, PROJECTIONS_CACHE_TTL_MS));
  return asArray(data.players).map(item => {
    const row = asRecord(item);
    const stats = asRecord(asArray(row.stats)[0]);
    return {
      playerId: asNumber(row.fpid) ?? 0,
      name: asString(row.name),
      team: asString(row.team_id),
      position: asString(row.position_id),
      points: asNumber(stats.points),
      pprPoints: asNumber(stats.points_ppr),
      passYards: asNumber(stats.pass_yds),
      passTouchdowns: asNumber(stats.pass_tds),
      interceptions: asNumber(stats.pass_ints),
      rushYards: asNumber(stats.rush_yds),
      rushTouchdowns: asNumber(stats.rush_tds),
    };
  }).filter(item => item.name);
}
