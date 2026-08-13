const API_BASE = "https://api.fantasypros.com/public/v2/json";

type CacheEntry<T> = { expiresAt: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

export type FantasyProsNewsItem = {
  id: number;
  playerId: number | null;
  playerName: string;
  team: string;
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
    throw new Error(`FantasyPros request failed with status ${response.status}`);
  }

  const value = (await response.json()) as T;
  cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs });
  return value;
}

export async function getFantasyProsNews(limit = 50, fpid?: number): Promise<FantasyProsNewsItem[]> {
  const query = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100)),
    order_by: "updated",
  });
  if (fpid != null) query.set("fpid", String(fpid));
  const data = asRecord(await request<unknown>(`/nfl/news?${query.toString()}`, 15 * 60_000));
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
    20 * 60_000,
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
  const data = asRecord(await request<unknown>(`/nfl/2026/consensus-rankings?${query.toString()}`, 60 * 60_000));
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
  const data = asRecord(await request<unknown>(`/nfl/2026/projections?${query.toString()}`, 60 * 60_000));
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
