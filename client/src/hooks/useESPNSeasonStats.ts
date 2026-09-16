/**
 * useESPNSeasonStats — fetches per-season stats for an NFL player
 * using the ESPN gamelog public API (sum of per-game stats).
 *
 * Endpoint: site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espnId}/gamelog?season={year}
 * Sums all regular-season game stats to produce season totals.
 *
 * Returns a list of SeasonStatRow objects sorted newest-first.
 * Caches in sessionStorage (24h TTL).
 *
 * The pure parsing logic (extractFromGamelog, extractFromSeasonTotals,
 * calculateSeasonRow, etc.) now lives in shared/espnSeasonStats.ts, re-
 * exported below, so a server-side historical backfill can reuse the
 * exact same, already-proven parsing.
 */
import { useState, useEffect } from "react";

const CACHE_PREFIX = "wrc_espn_gl_v8_";
const CACHE_NAMESPACE = "wrc_espn_gl_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function clearObsoleteHistoryCaches(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  const obsoleteKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(CACHE_NAMESPACE) && !key.startsWith(CACHE_PREFIX)) obsoleteKeys.push(key);
  }
  obsoleteKeys.forEach(key => storage.removeItem(key));
}

export {
  type SeasonStatRow,
  type UseESPNSeasonStatsResult,
  type ESPNGameEvent,
  extractFromGamelog,
  getPrimarySeasonTeam,
  extractFromSeasonTotals,
} from "@shared/espnSeasonStats";
import type { SeasonStatRow, UseESPNSeasonStatsResult, ESPNGameEvent } from "@shared/espnSeasonStats";
import { calculateSeasonRow, buildLabelMap, sumGameStats, extractFromGamelog, getPrimarySeasonTeam, extractFromSeasonTotals } from "@shared/espnSeasonStats";

export async function fetchSeasonStats(
  espnId: string,
  year: number,
  pos: string
): Promise<SeasonStatRow | null> {
  const cacheKey = `${CACHE_PREFIX}${espnId}_${year}`;
  try {
    clearObsoleteHistoryCaches(sessionStorage);
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    }
  } catch {}

  try {
    const res = await fetch(`/api/espn/athlete/${espnId}/gamelog?season=${year}`);
    if (!res.ok) return null;
    const d = await res.json();

    const labels: string[] = d.labels ?? [];
    if (!labels.length) {
      const fallbackResponse = await fetch(`/api/espn/athlete/${espnId}/stats?season=${year}`);
      if (!fallbackResponse.ok) return null;
      const fallbackData = await fallbackResponse.json();
      const fallback = extractFromSeasonTotals(fallbackData.categories ?? [], fallbackData.teams ?? {}, year);
      if (!fallback) return null;
      const row = calculateSeasonRow(year, pos, fallback);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: row })); } catch {}
      return row;
    }

    // Find regular season events (seasonTypes[1] or the one with most events)
    const seasonTypes: Array<{ categories?: Array<{ events?: ESPNGameEvent[] }> }> = d.seasonTypes ?? [];
    let regularEvents: ESPNGameEvent[] = [];
    for (const st of seasonTypes) {
      for (const cat of st.categories ?? []) {
        const evs = cat.events ?? [];
        if (evs.length > regularEvents.length) regularEvents = evs;
      }
    }

    if (!regularEvents.length) return null;

    const gp = regularEvents.length;
    const lm = buildLabelMap(labels);
    const totals = sumGameStats(regularEvents, Object.fromEntries(Object.entries(lm).map(([k, v]) => [k, v])));
    const extracted = extractFromGamelog(totals, gp, labels);

    const row = calculateSeasonRow(year, pos, { ...extracted, team: getPrimarySeasonTeam(regularEvents, d.events ?? {}) });

    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: row })); } catch {}
    return row;
  } catch (e) {
    console.error(`ESPN gamelog fetch failed for ${espnId} ${year}:`, e);
    return null;
  }
}

export function useESPNSeasonStats(
  espnId: string | null | undefined,
  pos: string
): UseESPNSeasonStatsResult {
  const [seasons, setSeasons] = useState<SeasonStatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!espnId) return;
    setLoading(true);
    setError(null);

    const years = [2025, 2024, 2023, 2022, 2021, 2020];
    Promise.all(years.map(yr => fetchSeasonStats(espnId, yr, pos)))
      .then(results => {
        const valid = results.filter((r): r is SeasonStatRow => r !== null);
        setSeasons(valid.sort((a, b) => b.season - a.season));
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [espnId, pos]);

  return { seasons, loading, error };
}
