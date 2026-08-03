/**
 * useDraftedRoster
 * Fetches all completed draft picks from Supabase and builds per-team rosters.
 * Falls back to static wrcData rosters when no picks exist (pre-draft).
 *
 * Returns:
 *   - rostersByTeam: Record<teamName, RosterPlayer[]>
 *   - loading: boolean
 *   - draftComplete: boolean  (true when draft_state.complete = true)
 *   - hasPicks: boolean       (true when at least one pick exists)
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { TEAMS, type RosterPlayer } from "@/lib/wrcData";
import { NFL_PLAYERS_2026 } from "@/lib/nflPlayers2026";

interface DbDraftPick {
  round: number;
  pick: number;
  overall: number;
  team_name: string;
  owner: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string;
}

export interface DraftedRosterResult {
  rostersByTeam: Record<string, RosterPlayer[]>;
  loading: boolean;
  hasPicks: boolean;
  draftComplete: boolean;
}

let _pid = 10000;
function makeId() { return `dp${++_pid}`; }

export function useDraftedRoster(): DraftedRosterResult {
  const [rostersByTeam, setRostersByTeam] = useState<Record<string, RosterPlayer[]>>({});
  const [loading, setLoading] = useState(true);
  const [hasPicks, setHasPicks] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [{ data: picks }, { data: stateData }] = await Promise.all([
        supabase.from("draft_picks").select("*").order("overall", { ascending: true }),
        supabase.from("draft_state").select("complete").eq("id", 1).single(),
      ]);

      if (!mounted) return;

      if (!picks || picks.length === 0) {
        // No picks yet — use static rosters
        const staticMap: Record<string, RosterPlayer[]> = {};
        for (const team of TEAMS) {
          staticMap[team.teamName] = team.players;
        }
        setRostersByTeam(staticMap);
        setHasPicks(false);
        setDraftComplete(stateData?.complete ?? false);
        setLoading(false);
        return;
      }

      // Build rosters from draft picks
      const byTeam: Record<string, RosterPlayer[]> = {};

      for (const pick of picks as DbDraftPick[]) {
        if (!byTeam[pick.team_name]) byTeam[pick.team_name] = [];

        // Try to find bye week from the NFL player pool
        const poolPlayer = NFL_PLAYERS_2026.find(
          p => p.name.toLowerCase() === pick.player_name.toLowerCase()
        );

        const player: RosterPlayer = {
          id: makeId(),
          name: pick.player_name,
          pos: pick.player_pos as RosterPlayer["pos"],
          nflTeam: pick.player_nfl_team,
          byeWeek: poolPlayer?.bye ?? null,
          acquisition: "Draft",
        };

        byTeam[pick.team_name].push(player);
      }

      // For teams with no picks yet, fall back to static roster
      for (const team of TEAMS) {
        if (!byTeam[team.teamName]) {
          byTeam[team.teamName] = team.players;
        }
      }

      setRostersByTeam(byTeam);
      setHasPicks(true);
      setDraftComplete(stateData?.complete ?? false);
      setLoading(false);
    }

    load();

    // Subscribe to new picks in real time
    const channel = supabase
      .channel("roster-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks" }, () => {
        if (mounted) load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "draft_state" }, () => {
        if (mounted) load();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { rostersByTeam, loading, hasPicks, draftComplete };
}
