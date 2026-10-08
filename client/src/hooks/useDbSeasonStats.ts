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

/**
 * Season-to-date stats for every team defense, keyed by normalized NFL team
 * code. Team defenses are stored under inconsistent names (draft pool
 * "KC Chiefs" vs roster "Kansas City Chiefs"), so a name lookup misses a D/ST
 * whose finalized rows carry a different name than the page's own label, and a
 * defense rostered for part of the season has its weeks split across both. The
 * server sums its weekly rows by team, so this is immune to that mismatch.
 */
export function useDbDstSeasonStats(season: number, enabled: boolean) {
  const query = trpc.playerStats.dstSeasonStats.useQuery(
    { season },
    { enabled, staleTime: 5 * 60_000 },
  );
  const byTeam = useMemo(
    () => (query.data ?? {}) as Record<string, PlayerSeasonStats>,
    [query.data],
  );
  return { byTeam, loading: query.isLoading };
}
