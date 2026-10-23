/**
 * Has the first real NFL game of a given week already kicked off?
 * Used to lock the rivalry game declaration window -- once true, no owner
 * can declare a rivalry game for that week for the rest of it, regardless
 * of when their own specific matchup's games happen to kick off.
 *
 * Checks TWO independent signals and treats either as sufficient:
 *   1. Tank01's gameStatus field (one of exactly three values, confirmed
 *      elsewhere in this codebase: "Scheduled", "In Progress", "Final").
 *   2. The scheduled kickoff time (gameDate/gameTime) has actually
 *      passed, computed directly rather than trusting gameStatus alone.
 * This second check exists because gameStatus has been directly observed
 * in production still showing "Scheduled" a dozen-plus minutes after a
 * game's actual scheduled kickoff -- Tank01's own status field lagging
 * real kickoff. Relying on gameStatus alone would let the rivalry
 * declaration window stay open past the real first snap during that lag.
 */

import { normalizeNFLTeamCode } from "../shared/nflTeamCodes";
import { hasEasternKickoffPassed } from "../shared/nflKickoffTime";
import { supabaseAdmin } from "./supabaseAdmin";

const TANK01_BASE_URL = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";

interface Tank01Game {
  gameStatus?: string;
  gameDate?: string;
  gameTime?: string;
  home?: string;
  away?: string;
}

// This module calls getNFLGamesForWeek DIRECTLY (not through tank01Proxy), so
// before this it was completely uncached: the rivalry-window check runs on
// every Live Scoring load for any owner who hasn't declared yet, so a dozen
// owners browsing on game day re-fetched the same week's game list upstream
// over and over. Caching it here is safe because "has a game started" is
// computed from each game's STATIC scheduled kickoff time vs Date.now() on
// every call (see hasKickoffTimePassed), so a slightly stale list still locks
// at the right moment -- only Tank01's own gameStatus (the secondary signal,
// which already lags real kickoff) ages, and the kickoff-time check covers that
// gap. Shared L2 lives in the same Supabase table as the proxy (under a "lock:"
// key prefix, so it can't collide with the proxy's own entries) so all
// serverless instances and all owners collapse onto one upstream call per
// window; L1 is a per-instance memo. Both are best-effort -- any error falls
// through to a normal fetch, so a cache problem can never wedge the lock.
const SHARED_CACHE_TABLE = "tank01_response_cache";
const GAMES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const gamesMemo = new Map<string, { ts: number; games: Tank01Game[] }>();

/** Test-only: clear the per-instance games memo so cases don't leak cached
 * game lists into one another. */
export function __clearGamesCacheForTests(): void {
  gamesMemo.clear();
}

async function readGamesCache(cacheKey: string): Promise<Tank01Game[] | null> {
  const mem = gamesMemo.get(cacheKey);
  if (mem && Date.now() - mem.ts < GAMES_CACHE_TTL_MS) return mem.games;
  if (process.env.NODE_ENV === "test") return null;
  try {
    const { data, error } = await supabaseAdmin
      .from(SHARED_CACHE_TABLE)
      .select("body, updated_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (Date.now() - new Date(data.updated_at as string).getTime() >= GAMES_CACHE_TTL_MS) return null;
    const games = ((JSON.parse(data.body as string).body) ?? []) as Tank01Game[];
    if (games.length === 0) return null; // see writeGamesCache
    gamesMemo.set(cacheKey, { ts: Date.now(), games });
    return games;
  } catch {
    return null;
  }
}

async function writeGamesCache(cacheKey: string, rawBody: string, games: Tank01Game[]): Promise<void> {
  // An empty list is never a legitimate in-season week, so it is treated as a
  // bad upstream response and not cached. Caching one would hold these locks
  // OPEN for the whole TTL, across every instance via the shared table: with no
  // games to inspect, hasWeekKickedOff returns false and the rivalry window
  // would stay declarable past a real kickoff. Uncached, a blip costs one wrong
  // answer and the next call refetches.
  if (games.length === 0) return;
  gamesMemo.set(cacheKey, { ts: Date.now(), games });
  if (process.env.NODE_ENV === "test") return;
  try {
    await supabaseAdmin
      .from(SHARED_CACHE_TABLE)
      .upsert({ cache_key: cacheKey, status: 200, content_type: "application/json", body: rawBody, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch {
    // best-effort
  }
}

/** Has this game's Eastern kickoff time passed? Uses the real Eastern offset for
 * that date (EDT before Nov 1 2026, EST after) -- see shared/nflKickoffTime.ts. */
function hasKickoffTimePassed(gameDate: string | undefined, gameTime: string | undefined): boolean {
  return hasEasternKickoffPassed(gameDate, gameTime);
}

function hasGameStarted(game: Tank01Game): boolean {
  return Boolean(game.gameStatus && game.gameStatus !== "Scheduled") || hasKickoffTimePassed(game.gameDate, game.gameTime);
}

async function fetchGamesForWeek(week: number, season: number): Promise<Tank01Game[]> {
  const cacheKey = `lock:getNFLGamesForWeek?week=${week}&season=${season}`;
  const cached = await readGamesCache(cacheKey);
  if (cached) return cached;

  const key = process.env.TANK01_API_KEY;
  if (!key) throw new Error("Tank01 API credential is unavailable.");
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com" };
  const response = await fetch(
    `${TANK01_BASE_URL}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Unable to load this week's NFL games (${response.status}).`);
  const payload = await response.json();
  const games = (payload.body ?? []) as Tank01Game[];
  await writeGamesCache(cacheKey, JSON.stringify(payload), games);
  return games;
}

export async function hasWeekKickedOff(week: number, season: number): Promise<boolean> {
  const games = await fetchGamesForWeek(week, season);
  return games.some(hasGameStarted);
}

/**
 * Has a specific NFL team's game this week already started? Used to lock
 * a free agent's bid/pickup eligibility the moment their own game kicks
 * off, for the rest of that week -- independent of whether any OTHER
 * game around the league has started. A team with no game this week
 * (bye) is never considered started.
 */
export async function hasPlayerTeamGameStarted(nflTeam: string, week: number, season: number): Promise<boolean> {
  const games = await fetchGamesForWeek(week, season);
  const normTeam = normalizeNFLTeamCode(nflTeam);
  const game = games.find(g => normalizeNFLTeamCode(g.home ?? "") === normTeam || normalizeNFLTeamCode(g.away ?? "") === normTeam);
  if (!game) return false; // no game this week → not started (bye)
  return hasGameStarted(game);
}
