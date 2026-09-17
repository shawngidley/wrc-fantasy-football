import { supabaseAdmin } from "./supabaseAdmin";
import { CACHE_KEYS } from "./fantasyprosFetcher";

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

/**
 * Every read in this app goes through this cache, never FantasyPros
 * directly -- server/fantasyprosFetcher.ts is the only code that calls
 * api.fantasypros.com, on a fixed schedule. Serves whatever is stored even
 * if it's past its expires_at (stale is always better than blocking a
 * user-facing request on an upstream call), and a missing key just yields
 * an empty payload rather than an error -- the caller's own `asArray`/
 * `asRecord` handling already turns that into an empty result of the right
 * shape further down.
 */
async function readCache(key: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from("fantasypros_cache").select("payload").eq("key", key).maybeSingle();
  if (error) {
    console.error(`[fantasypros] cache read failed for "${key}": ${error.message}`);
    return {};
  }
  if (!data) {
    console.warn(`[fantasypros] cache miss for "${key}"`);
    return {};
  }
  return asRecord(data.payload);
}

function parseNewsItem(item: unknown): FantasyProsNewsItem {
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
}

export async function getFantasyProsNews(limit = 50, fpid?: number): Promise<FantasyProsNewsItem[]> {
  const data = await readCache(CACHE_KEYS.news());
  const items = asArray(data.items).map(parseNewsItem).filter(item => item.title);
  // A per-player request is served by filtering the cached league-wide
  // feed rather than a dedicated upstream call -- see fetchAndStore's
  // budget cap, which the app used to blow through with one extra call
  // per roster player on every page load.
  const filtered = fpid != null ? items.filter(item => item.playerId === fpid) : items;
  return filtered.slice(0, Math.min(Math.max(limit, 1), 100));
}

export async function getFantasyProsInjuries(year: number, week: number): Promise<FantasyProsInjury[]> {
  const data = await readCache(CACHE_KEYS.injuries(year, week));
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
  const data = await readCache(CACHE_KEYS.ranks(position, week));
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
  const data = await readCache(CACHE_KEYS.projections(position, week));
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
