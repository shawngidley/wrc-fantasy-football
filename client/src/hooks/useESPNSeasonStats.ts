/**
 * useESPNSeasonStats — fetches per-season stats for an NFL player
 * using the ESPN v2 public API.
 *
 * Endpoint: sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{year}/types/2/athletes/{espnId}/statistics
 * type=2 = regular season
 *
 * Returns a map of season year → normalized stats object.
 * Fetches the last 5 seasons in parallel and caches in sessionStorage (24h TTL).
 */
import { useState, useEffect } from "react";
import { calcFantasyPoints } from "@/lib/scoringEngine";

const ESPN_BASE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const CACHE_PREFIX = "wrc_espn_stats_v1_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SeasonStatRow {
  season: number;
  gp: number;
  // Passing
  passYds?: number;
  passTD?: number;
  passInt?: number;
  passAtt?: number;
  passCmp?: number;
  passCmpPct?: number;
  passRating?: number;
  // Rushing
  rushYds?: number;
  rushTD?: number;
  rushAtt?: number;
  rushAvg?: number;
  // Receiving
  rec?: number;
  recYds?: number;
  recTD?: number;
  recTargets?: number;
  recAvg?: number;
  // Kicking
  fgMade?: number;
  fgAtt?: number;
  fgPct?: number;
  xpMade?: number;
  xpAtt?: number;
  // Defense
  sacks?: number;
  defInt?: number;
  defTD?: number;
  fumblesRecovered?: number;
  // Fumbles (all positions)
  fumbles?: number;
  fumblesLost?: number;
  // WRC fantasy points (calculated via scoring engine)
  wrcPts?: number;
  wrcPtsPerGame?: number;
}

export interface UseESPNSeasonStatsResult {
  seasons: SeasonStatRow[];
  loading: boolean;
  error: string | null;
}

function extractStats(cats: Array<Record<string, unknown>>): Partial<SeasonStatRow> {
  const result: Partial<SeasonStatRow> = {};

  for (const cat of cats) {
    const catName = (cat.name as string) ?? "";
    const statsList = (cat.stats as Array<Record<string, unknown>>) ?? [];
    const statsMap: Record<string, number> = {};
    for (const s of statsList) {
      statsMap[s.name as string] = (s.value as number) ?? 0;
    }

    if (catName === "passing") {
      result.passYds    = statsMap.passingYards ?? 0;
      result.passTD     = statsMap.passingTouchdowns ?? 0;
      result.passInt    = statsMap.interceptions ?? 0;
      result.passAtt    = statsMap.passingAttempts ?? 0;
      result.passCmp    = statsMap.completions ?? 0;
      result.passCmpPct = statsMap.completionPct ?? 0;
      result.passRating = statsMap.QBRating ?? 0;
    } else if (catName === "rushing") {
      result.rushYds = statsMap.rushingYards ?? 0;
      result.rushTD  = statsMap.rushingTouchdowns ?? 0;
      result.rushAtt = statsMap.rushingAttempts ?? 0;
      result.rushAvg = statsMap.yardsPerRushAttempt ?? 0;
    } else if (catName === "receiving") {
      result.rec        = statsMap.receptions ?? 0;
      result.recYds     = statsMap.receivingYards ?? 0;
      result.recTD      = statsMap.receivingTouchdowns ?? 0;
      result.recTargets = statsMap.receivingTargets ?? 0;
      result.recAvg     = statsMap.yardsPerReception ?? 0;
    } else if (catName === "kicking") {
      result.fgMade  = statsMap.fieldGoalsMade ?? 0;
      result.fgAtt   = statsMap.fieldGoalAttempts ?? 0;
      result.fgPct   = statsMap.fieldGoalPct ?? 0;
      result.xpMade  = statsMap.extraPointsMade ?? 0;
      result.xpAtt   = statsMap.extraPointAttempts ?? 0;
    } else if (catName === "defensive") {
      result.sacks             = statsMap.sacks ?? 0;
      result.defInt            = statsMap.interceptions ?? 0;
      result.defTD             = statsMap.defensiveTouchdowns ?? 0;
      result.fumblesRecovered  = statsMap.fumblesRecovered ?? 0;
    } else if (catName === "general") {
      result.fumbles     = statsMap.fumbles ?? 0;
      result.fumblesLost = statsMap.fumblesLost ?? 0;
    }
  }

  return result;
}

function rowToTank01Stats(row: Partial<SeasonStatRow>) {
  return {
    gamesPlayed: row.gp ?? 0,
    Passing: {
      passYds:   row.passYds ?? 0,
      passTD:    row.passTD ?? 0,
      int:       row.passInt ?? 0,
      passCompletions: row.passCmp ?? 0,
      passAttempts:    row.passAtt ?? 0,
    },
    Rushing: {
      rushYds: row.rushYds ?? 0,
      rushTD:  row.rushTD ?? 0,
      carries: row.rushAtt ?? 0,
    },
    Receiving: {
      receptions: row.rec ?? 0,
      recYds:     row.recYds ?? 0,
      recTD:      row.recTD ?? 0,
      targets:    row.recTargets ?? 0,
    },
    Kicking: {
      fgMade:     row.fgMade ?? 0,
      fgAttempts: row.fgAtt ?? 0,
      xpMade:     row.xpMade ?? 0,
      xpAttempts: row.xpAtt ?? 0,
    },
    Defense: {
      sacks:                  row.sacks ?? 0,
      defensiveInterceptions: row.defInt ?? 0,
      fumblesRecovered:       row.fumblesRecovered ?? 0,
      defTD:                  row.defTD ?? 0,
      fumblesLost:            row.fumblesLost ?? 0,
    },
  };
}

async function fetchSeasonStats(espnId: string, year: number, pos: string): Promise<SeasonStatRow | null> {
  const cacheKey = `${CACHE_PREFIX}${espnId}_${year}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL_MS) return data as SeasonStatRow;
    }
  } catch { /* ignore */ }

  try {
    const url = `${ESPN_BASE}/seasons/${year}/types/2/athletes/${espnId}/statistics`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const splits = data?.splits ?? {};
    const cats = (splits.categories ?? []) as Array<Record<string, unknown>>;

    // Get games played from general category
    const generalCat = cats.find((c: Record<string, unknown>) => c.name === "general");
    const generalStats = (generalCat?.stats as Array<Record<string, unknown>>) ?? [];
    const gpStat = generalStats.find((s: Record<string, unknown>) => s.name === "gamesPlayed");
    const gp = (gpStat?.value as number) ?? 0;

    const extracted = extractStats(cats);
    const row: SeasonStatRow = { season: year, gp, ...extracted };

    // Calculate WRC fantasy points for this season
    if (gp > 0) {
      const tank01Stats = rowToTank01Stats(row);
      const wrcPts = calcFantasyPoints(tank01Stats, pos);
      row.wrcPts = wrcPts;
      row.wrcPtsPerGame = gp > 0 ? Math.round((wrcPts / gp) * 10) / 10 : 0;
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: row, timestamp: Date.now() }));
    } catch { /* ignore */ }

    return row;
  } catch {
    return null;
  }
}

export function useESPNSeasonStats(espnId: string | null | undefined, pos = ""): UseESPNSeasonStatsResult {
  const [seasons, setSeasons] = useState<SeasonStatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!espnId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const currentYear = new Date().getFullYear();
    // Fetch last 5 seasons (excluding current year since season hasn't started)
    const years = [currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5];

    Promise.all(years.map((y) => fetchSeasonStats(espnId, y, pos))).then((results) => {
      if (cancelled) return;
      const valid = results.filter((r): r is SeasonStatRow => r !== null && r.gp > 0);
      setSeasons(valid);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load season stats");
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [espnId, pos]);

  return { seasons, loading, error };
}
