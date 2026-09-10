import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNFLMatchups } from "@/hooks/useNFLMatchups";
import { useNFLLiveScores, getLivePoints } from "@/hooks/useNFLLiveScores";

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
export function useOwnerMatchupScore(myTeamName: string, oppTeamName: string, week: number): UseOwnerMatchupScoreResult {
  const { matchups: matchupMap } = useNFLMatchups(week, 2026);
  const { liveScores } = useNFLLiveScores(week, 2026, matchupMap);
  const [myStarters, setMyStarters] = useState<StarterInfo[]>([]);
  const [oppStarters, setOppStarters] = useState<StarterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data: teams } = await supabase.from("teams").select("id, name").in("name", [myTeamName, oppTeamName]);
      const myTeamId = teams?.find(t => t.name === myTeamName)?.id;
      const oppTeamId = teams?.find(t => t.name === oppTeamName)?.id;
      if (!myTeamId || !oppTeamId) {
        if (!cancelled) { setMyStarters([]); setOppStarters([]); setLoading(false); }
        return;
      }

      const [{ data: lineupRows }, { data: playerRows }] = await Promise.all([
        supabase.from("lineups").select("team_id, player_name, is_bench").eq("week", week).eq("season", 2026).in("team_id", [myTeamId, oppTeamId]),
        supabase.from("players").select("name, position, nfl_team, team_id").in("team_id", [myTeamId, oppTeamId]),
      ]);

      const playerByName = new Map((playerRows ?? []).map(p => [p.name, p]));
      const buildStarters = (teamId: string): StarterInfo[] =>
        (lineupRows ?? [])
          .filter(row => row.team_id === teamId && !row.is_bench)
          .map(row => {
            const p = playerByName.get(row.player_name);
            return { name: row.player_name, position: p?.position ?? "", nflTeam: p?.nfl_team ?? "" };
          });

      if (!cancelled) {
        setMyStarters(buildStarters(myTeamId));
        setOppStarters(buildStarters(oppTeamId));
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [myTeamName, oppTeamName, week]);

  const myScore = useMemo(
    () => myStarters.reduce((sum, s) => sum + (getLivePoints(liveScores, s.name, s.position, s.nflTeam) ?? 0), 0),
    [myStarters, liveScores],
  );
  const oppScore = useMemo(
    () => oppStarters.reduce((sum, s) => sum + (getLivePoints(liveScores, s.name, s.position, s.nflTeam) ?? 0), 0),
    [oppStarters, liveScores],
  );

  return { myScore, oppScore, loading };
}
