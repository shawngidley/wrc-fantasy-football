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

interface DbRosterMove {
  id: number;
  move_type: "ADD" | "DROP" | "TRADE";
  team_name: string;
  owner: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string;
  faab_spent: number | null;
  created_at: string;
}

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

/**
 * Mutates byTeam in place:
 *   ADD  → appends player to the team's roster
 *   DROP → removes player by name from the team's roster
 */
function applyMoves(byTeam: Record<string, RosterPlayer[]>, moves: DbRosterMove[]) {
  for (const move of moves) {
    if (!byTeam[move.team_name]) byTeam[move.team_name] = [];
    if (move.move_type === "ADD") {
      // Avoid duplicates
      const alreadyOn = byTeam[move.team_name].some(
        p => p.name.toLowerCase() === move.player_name.toLowerCase()
      );
      if (!alreadyOn) {
        const poolPlayer = NFL_PLAYERS_2026.find(
          p => p.name.toLowerCase() === move.player_name.toLowerCase()
        );
        byTeam[move.team_name].push({
          id: makeId(),
          name: move.player_name,
          pos: move.player_pos as RosterPlayer["pos"],
          nflTeam: move.player_nfl_team,
          byeWeek: poolPlayer?.bye ?? null,
          acquisition: "FA",
        });
      }
    } else if (move.move_type === "DROP") {
      byTeam[move.team_name] = byTeam[move.team_name].filter(
        p => p.name.toLowerCase() !== move.player_name.toLowerCase()
      );
    }
    // TRADE moves are display-only in Transactions; roster impact handled via ADD+DROP pairs
  }
}

export function useDraftedRoster(): DraftedRosterResult {
  const [rostersByTeam, setRostersByTeam] = useState<Record<string, RosterPlayer[]>>({});
  const [loading, setLoading] = useState(true);
  const [hasPicks, setHasPicks] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [{ data: picks }, { data: stateData }, { data: moves }] = await Promise.all([
        supabase.from("draft_picks").select("*").order("overall", { ascending: true }),
        supabase.from("draft_state").select("complete").eq("id", 1).single(),
        supabase.from("roster_moves").select("*").order("created_at", { ascending: true }),
      ]);

      if (!mounted) return;

      if (!picks || picks.length === 0) {
        // No picks yet — use static rosters, still apply any waiver moves
        const staticMap: Record<string, RosterPlayer[]> = {};
        for (const team of TEAMS) {
          staticMap[team.teamName] = [...team.players];
        }
        // Apply waiver moves to static rosters
        if (moves && moves.length > 0) {
          applyMoves(staticMap, moves as DbRosterMove[]);
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
          byTeam[team.teamName] = [...team.players];
        }
      }

      // Apply waiver adds/drops on top of draft rosters
      if (moves && moves.length > 0) {
        applyMoves(byTeam, moves as DbRosterMove[]);
      }

      setRostersByTeam(byTeam);
      setHasPicks(true);
      setDraftComplete(stateData?.complete ?? false);
      setLoading(false);
    }

    load();

    // Subscribe to new picks and roster moves in real time
    const channel = supabase
      .channel("roster-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draft_picks" }, () => {
        if (mounted) load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "draft_state" }, () => {
        if (mounted) load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roster_moves" }, () => {
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
