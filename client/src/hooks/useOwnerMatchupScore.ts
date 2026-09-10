import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNFLMatchups } from "@/hooks/useNFLMatchups";
import { useNFLLiveScores, getLivePoints } from "@/hooks/useNFLLiveScores";
import { buildDefaultStarters } from "@/lib/defaultLineup";
import { useDraftPlayerUniverse } from "@/hooks/useDraftPlayerUniverse";

interface StarterInfo {
  name: string;
  position: string;
  nflTeam: string;
}

interface UseOwnerMatchupScoreResult {
  myScore: number;
  oppScore: number;
  loading: boolean;
}

/**
 * Computes just the current live point total for a specific matchup (two
 * team names), for a compact score display -- e.g. the Standings page's
 * "Week N Matchup" card. Deliberately lighter than buildMatchupsFromLineups
 * on Live Scoring: no projections, no per-player display data, no game
 * status -- just the two numbers.
 */
/**
 * Computes just the current live point total for a specific matchup (two
 * team IDs), for a compact score display -- e.g. the Standings page's
 * "Week N Matchup" card. Deliberately lighter than buildMatchupsFromLineups
 * on Live Scoring: no projections, no per-player display data, no game
 * status -- just the two numbers.
 *
 * Takes team IDs directly rather than resolving them from team names via a
 * client-side "teams" table query -- confirmed live that query was
 * silently returning nothing (likely RLS, since nothing else in this app
 * reads "teams" client-side; every other page resolves an owner straight
 * to their team_id via the same static OWNER_TO_TEAM_ID mapping this
 * hook's caller already uses elsewhere on this page).
 */
export function useOwnerMatchupScore(myTeamId: string, oppTeamId: string, week: number): UseOwnerMatchupScoreResult {
  const { matchups: matchupMap } = useNFLMatchups(week, 2026);
  const { liveScores, liveStats, kickerEvents } = useNFLLiveScores(week, 2026, matchupMap);
  const draftPlayerPool = useDraftPlayerUniverse();
  const [myStarters, setMyStarters] = useState<StarterInfo[]>([]);
  const [oppStarters, setOppStarters] = useState<StarterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const [{ data: lineupRows }, { data: playerRows }] = await Promise.all([
        supabase.from("lineups").select("team_id, player_name, is_bench").eq("week", week).eq("season", 2026).in("team_id", [myTeamId, oppTeamId]),
        supabase.from("players").select("id, name, position, nfl_team, team_id").in("team_id", [myTeamId, oppTeamId]),
      ]);

      const playerByName = new Map((playerRows ?? []).map(p => [p.name, p]));
      const buildStarters = (teamId: string): StarterInfo[] => {
        const savedLineup = (lineupRows ?? []).filter(row => row.team_id === teamId && !row.is_bench);
        if (savedLineup.length > 0) {
          return savedLineup.map(row => {
            const p = playerByName.get(row.player_name);
            return { name: row.player_name, position: p?.position ?? "", nflTeam: p?.nfl_team ?? "" };
          });
        }
        // No saved lineup yet for this team/week -- same ADP-based default
        // Live Scoring already falls back to, so this matches what that
        // page would actually show instead of reporting 0.0.
        const teamPlayers = (playerRows ?? []).filter(p => p.team_id === teamId);
        return buildDefaultStarters(teamPlayers, draftPlayerPool).map(({ player }) => ({
          name: player.name, position: player.position, nflTeam: player.nfl_team,
        }));
      };

      if (!cancelled) {
        setMyStarters(buildStarters(myTeamId));
        setOppStarters(buildStarters(oppTeamId));
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [myTeamId, oppTeamId, week, draftPlayerPool]);

  const myScore = useMemo(
    () => myStarters.reduce((sum, s) => sum + (getLivePoints(liveScores, s.name, s.position, s.nflTeam, kickerEvents, liveStats) ?? 0), 0),
    [myStarters, liveScores, kickerEvents, liveStats],
  );
  const oppScore = useMemo(
    () => oppStarters.reduce((sum, s) => sum + (getLivePoints(liveScores, s.name, s.position, s.nflTeam, kickerEvents, liveStats) ?? 0), 0),
    [oppStarters, liveScores, kickerEvents, liveStats],
  );

  return { myScore, oppScore, loading };
}
