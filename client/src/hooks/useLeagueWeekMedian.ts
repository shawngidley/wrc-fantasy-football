import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNFLMatchups } from "@/hooks/useNFLMatchups";
import { useNFLLiveScores, getLivePoints } from "@/hooks/useNFLLiveScores";
import { buildDefaultStarters } from "@/lib/defaultLineup";
import { useDraftPlayerUniverse } from "@/hooks/useDraftPlayerUniverse";
import { resolveRosterPlayerForLineupEntry, type RosterPlayerRow } from "@shared/rosterPlayerResolution";
import { normalizePlayerName } from "@shared/playerNameMatch";

interface StarterInfo {
  name: string;
  position: string;
  nflTeam: string;
}

interface UseLeagueWeekMedianResult {
  median: number | null;
  loading: boolean;
}

/**
 * Live league median for a given week: the median of every team's live
 * point total that week, built the same lighter way useOwnerMatchupScore
 * builds the matchup card's H2H scores (each team's saved lineup if it has
 * one, an ADP-based default otherwise, then live points per starter).
 *
 * Why this exists: the Lineup page and the Standings matchup card both
 * used to take the median of team_standings.pts_for, which is the
 * cumulative SEASON points-for and only moves when a week is finalized.
 * Mid-week that showed the last finalized week's median rather than this
 * week's -- Week 2 in progress still displayed the end-of-Week-1 median.
 *
 * Only teams with a positive live score count toward the median, matching
 * the Live Scoring page's scoreboard median so the number the card shows
 * agrees with the one you see after tapping through to "View Live".
 * Returns null until at least one team has scored this week.
 */
export function useLeagueWeekMedian(teamIds: readonly string[], week: number): UseLeagueWeekMedianResult {
  const { matchups: matchupMap } = useNFLMatchups(week, 2026);
  const { liveScores, liveStats, kickerEvents } = useNFLLiveScores(week, 2026, matchupMap);
  const draftPlayerPool = useDraftPlayerUniverse();
  const [startersByTeam, setStartersByTeam] = useState<Record<string, StarterInfo[]>>({});
  const [loading, setLoading] = useState(true);

  // Stable primitive dependency so a fresh array with the same ids each
  // render doesn't re-run the load.
  const teamKey = [...teamIds].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const ids = teamKey ? teamKey.split(",") : [];
      if (ids.length === 0) {
        if (!cancelled) { setStartersByTeam({}); setLoading(false); }
        return;
      }
      const [{ data: lineupRows }, { data: playerRows }] = await Promise.all([
        supabase.from("lineups").select("team_id, player_id, player_name, slot, is_bench").eq("week", week).eq("season", 2026).in("team_id", ids),
        supabase.from("players").select("id, name, position, nfl_team, team_id").in("team_id", ids),
      ]);

      const playerById = new Map((playerRows ?? []).map(p => [p.id, p as RosterPlayerRow]));
      const playerByNormalizedName = new Map((playerRows ?? []).map(p => [normalizePlayerName(p.name), p as RosterPlayerRow]));
      const buildStarters = (teamId: string): StarterInfo[] => {
        const savedLineup = (lineupRows ?? []).filter(row => row.team_id === teamId && !row.is_bench);
        if (savedLineup.length > 0) {
          return savedLineup.map(row => {
            const p = resolveRosterPlayerForLineupEntry(row, playerById, playerByNormalizedName, (playerRows ?? []) as RosterPlayerRow[]);
            return { name: row.player_name, position: p?.position ?? "", nflTeam: p?.nfl_team ?? "" };
          });
        }
        // No saved lineup yet: same ADP-based default Live Scoring and
        // useOwnerMatchupScore fall back to, so all three agree.
        const teamPlayers = (playerRows ?? []).filter(p => p.team_id === teamId);
        return buildDefaultStarters(teamPlayers, draftPlayerPool).map(({ player }) => ({
          name: player.name, position: player.position, nflTeam: player.nfl_team,
        }));
      };

      if (!cancelled) {
        const map: Record<string, StarterInfo[]> = {};
        for (const id of ids) map[id] = buildStarters(id);
        setStartersByTeam(map);
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teamKey, week, draftPlayerPool]);

  const median = useMemo(() => {
    const scores = Object.values(startersByTeam)
      .map(starters => starters.reduce((sum, s) => sum + (getLivePoints(liveScores, s.name, s.position, s.nflTeam, kickerEvents, liveStats) ?? 0), 0))
      .filter(score => score > 0)
      .sort((a, b) => a - b);
    if (scores.length === 0) return null;
    const mid = Math.floor(scores.length / 2);
    return scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
  }, [startersByTeam, liveScores, liveStats, kickerEvents]);

  return { median, loading };
}
