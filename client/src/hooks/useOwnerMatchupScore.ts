import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useNFLMatchups } from "@/hooks/useNFLMatchups";
import { useNFLLiveScores, getLivePoints } from "@/hooks/useNFLLiveScores";
import { buildDefaultStarters, fillEmptyStarterSlots, STARTER_SLOT_ORDER } from "@/lib/defaultLineup";
import { useDraftPlayerUniverse } from "@/hooks/useDraftPlayerUniverse";
import { resolveRosterPlayerForLineupEntry, type RosterPlayerRow } from "@shared/rosterPlayerResolution";
import { normalizePlayerName } from "@shared/playerNameMatch";

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

// A roster player with a guaranteed id, so it satisfies the backfill
// helper's identity requirement (fillEmptyStarterSlots dedupes on player.id).
// The players table always returns an id; this narrows the type.
type ScorePlayer = RosterPlayerRow & { id: string };

/**
 * Computes just the current live point total for a specific matchup (two
 * team IDs), for a compact score display -- e.g. the Standings page's
 * "Week N Matchup" card. Deliberately lighter than buildMatchupsFromLineups
 * on Live Scoring: no projections, no per-player display data, no game
 * status -- just the two numbers.
 *
 * Starter resolution, though, is deliberately the SAME as Live Scoring, so
 * the two agree on which players a team is actually scored on:
 *   1. Carry-forward lineups (league.lineupsForWeek / resolveLineupsForWeek),
 *      NOT the exact-week lineups table -- a team that hasn't re-saved this
 *      week is still scored on its most recent saved lineup, the same rows
 *      the Lineup page and Live Scoring use.
 *   2. Empty starter slots backfilled from the bench (fillEmptyStarterSlots)
 *      -- a real starter who isn't in the saved lineup (a FAAB/waiver add,
 *      or a slot whose saved name was since dropped) is promoted into the
 *      open slot instead of silently scoring 0.
 * This hook previously did neither, which made the Standings card drop a
 * real starter's points versus what Live Scoring showed the same team.
 */
export function useOwnerMatchupScore(myTeamId: string, oppTeamId: string, week: number): UseOwnerMatchupScoreResult {
  const { matchups: matchupMap } = useNFLMatchups(week, 2026);
  const { liveScores, liveStats, kickerEvents } = useNFLLiveScores(week, 2026, matchupMap);
  const draftPlayerPool = useDraftPlayerUniverse();
  const trpcUtils = trpc.useUtils();
  const [myStarters, setMyStarters] = useState<StarterInfo[]>([]);
  const [oppStarters, setOppStarters] = useState<StarterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      // Carry-forward lineups for every team (same source Live Scoring uses),
      // plus the two teams' rosters.
      const [lineupRows, { data: playerRows }] = await Promise.all([
        trpcUtils.league.lineupsForWeek.fetch({ week, season: 2026 }),
        supabase.from("players").select("id, name, position, nfl_team, team_id").in("team_id", [myTeamId, oppTeamId]),
      ]);

      const buildStarters = (teamId: string): StarterInfo[] => {
        const teamPlayers = (playerRows ?? []).filter(p => p.team_id === teamId) as ScorePlayer[];
        const playerById: Map<string, RosterPlayerRow> = new Map(teamPlayers.map(p => [p.id, p]));
        const playerByNormalizedName: Map<string, RosterPlayerRow> = new Map(teamPlayers.map(p => [normalizePlayerName(p.name), p]));
        const savedRows = (lineupRows ?? []).filter(row => row.team_id === teamId);

        if (savedRows.length > 0) {
          // Resolve each saved row to a current roster player (suffix-, id-
          // and DST-aware), splitting into starters and bench exactly as Live
          // Scoring's buildSide does.
          const used = new Set<string>();
          const starters: Array<{ slot: string; player: ScorePlayer }> = [];
          const bench: ScorePlayer[] = [];
          for (const row of savedRows) {
            const p = resolveRosterPlayerForLineupEntry(row, playerById, playerByNormalizedName, teamPlayers) as ScorePlayer | undefined;
            if (!p) continue;
            used.add(p.id);
            if (row.is_bench) bench.push(p);
            else starters.push({ slot: row.slot.replace(/^(RB|WR|TE)\d+$/, "$1"), player: p });
          }
          // Roster players missing from the saved lineup (e.g. a FAAB add made
          // after the owner last saved) still belong to the team -- put them on
          // the bench so backfill can promote them into any empty slot.
          for (const p of teamPlayers) if (!used.has(p.id)) bench.push(p);
          const { starters: filled } = fillEmptyStarterSlots(starters, bench, STARTER_SLOT_ORDER, draftPlayerPool);
          return filled.map(({ player }) => ({ name: player.name, position: player.position, nflTeam: player.nfl_team }));
        }

        // No saved lineup anywhere yet for this team -- same ADP-based default
        // Live Scoring falls back to, so the two agree instead of reporting 0.0.
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
  }, [myTeamId, oppTeamId, week, draftPlayerPool, trpcUtils]);

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
