/**
 * useHistoricalSeasonStats — reads a completed historical season's
 * (2023-2025) stats directly from the database (season_stats_historical,
 * populated once by a manually-triggered backfill from ESPN's gamelog)
 * instead of fetching live from ESPN per player on every page load.
 * Unlike the current season, these years never change, so this can be a
 * plain, cheap database read with no live-fetch fallback needed.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { PlayerSeasonStats } from "@shared/playerSeasonStats";

export function useHistoricalSeasonStats(playerNames: string[], season: number, enabled: boolean) {
  const query = trpc.playerStats.historicalSeasonStats.useQuery(
    { playerNames, season },
    { enabled: enabled && playerNames.length > 0, staleTime: 60 * 60_000 },
  );

  const statMap = useMemo(() => {
    const map: Record<string, PlayerSeasonStats> = {};
    const data = query.data ?? {};
    for (const name of Object.keys(data)) map[name.toLowerCase()] = data[name] as PlayerSeasonStats;
    return map;
  }, [query.data]);

  return { statMap, loading: query.isLoading, loadedCount: Object.keys(statMap).length };
}
