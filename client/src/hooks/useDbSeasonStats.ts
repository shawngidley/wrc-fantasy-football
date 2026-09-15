/**
 * useDbSeasonStats — season-to-date stats read directly from WRC's own
 * database (player_weekly_stats, summed across every finalized week for
 * this season) instead of independently recomputing them client-side
 * from Tank01/ESPN. That data is already computed correctly, once,
 * server-side during official weekly finalization (the same numbers
 * that determine actual scoring and standings) -- this reads it back
 * rather than maintaining a second, separate computation that can
 * drift out of sync with the official one (the exact pattern behind
 * several bugs fixed this session: the field-goal scoring gap, the
 * empty-stats caching issue).
 *
 * Covers only already-finalized weeks, since that's all
 * player_weekly_stats holds. For the current, in-progress week, the
 * caller should still fall back to live data (Live Scoring's own hooks)
 * if it wants up-to-the-minute numbers for a game still in progress.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { PlayerSeasonStats } from "@shared/playerSeasonStats";

export function useDbSeasonStats(playerNames: string[], season: number, enabled: boolean) {
  const query = trpc.playerStats.seasonStats.useQuery(
    { playerNames, season },
    { enabled: enabled && playerNames.length > 0, staleTime: 5 * 60_000 },
  );

  const statMap = useMemo(() => {
    const map: Record<string, PlayerSeasonStats> = {};
    const data = query.data ?? {};
    for (const name of Object.keys(data)) map[name.toLowerCase()] = data[name] as PlayerSeasonStats;
    return map;
  }, [query.data]);

  return { statMap, loading: query.isLoading, loadedCount: Object.keys(statMap).length };
}
