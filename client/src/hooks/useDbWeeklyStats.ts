/**
 * useDbWeeklyStats — per-week stat lines from WRC's own database
 * (player_weekly_stats), read back through playerStats.weeklyStats rather than
 * recomputed client-side. Each entry is one finalized week's line in the same
 * camelCase shape as useDbSeasonStats. Used by the player card's game log for
 * team defenses, which have no Tank01 per-player game feed.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { PlayerSeasonStats } from "@shared/playerSeasonStats";

export type WeeklyStatLine = { week: number } & PlayerSeasonStats;

export function useDbWeeklyStats(playerNames: string[], season: number, enabled: boolean) {
  const query = trpc.playerStats.weeklyStats.useQuery(
    { playerNames, season },
    { enabled: enabled && playerNames.length > 0, staleTime: 5 * 60_000 },
  );

  const weeksByPlayer = useMemo(() => {
    const map: Record<string, WeeklyStatLine[]> = {};
    const data = query.data ?? {};
    for (const name of Object.keys(data)) {
      map[name.toLowerCase()] = (data[name] as WeeklyStatLine[]).slice().sort((a, b) => a.week - b.week);
    }
    return map;
  }, [query.data]);

  return { weeksByPlayer, loading: query.isLoading };
}
