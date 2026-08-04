/**
 * useDraftedRoster
 * Single source of truth for all roster data.
 *
 * Priority order:
 *   1. If draft has started (picks exist): draft_picks table (live picks)
 *   2. Else: Supabase `players` table (seeded from Excel, editable by commissioner)
 *   3. Waiver moves from roster_moves are applied on top of either source
 *
 * Falls back to static wrcData ONLY if Supabase is completely unreachable.
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

interface DbPlayer {
  id: string;
  team_id: string;
  name: string;
  position: string;
  nfl_team: string;
  acquisition: string;
  draft_round: number | null;
  bye_week: number;
  status: string;
}

export interface DraftedRosterResult {
  rostersByTeam: Record<string, RosterPlayer[]>;
  loading: boolean;
  hasPicks: boolean;
  draftComplete: boolean;
}

// team_id → team_name (matches teams table — updated to correct 2026 names)
const TEAM_ID_TO_NAME: Record<string, string> = {
  "team-jonas":   "The Super Snuffleupagus",
  "team-davidr":  "The Boys of Fall",
  "team-jason":   "Heiden's Hardtimes",
  "team-keith":   "HamSandwich",
  "team-dan":     "Legion of Doom",
  "team-jamie":   "The Four Horsemen",
  "team-bill":    "Billy Goats Gruff",
  "team-scottn":  "Millertime",
  "team-shawn":   "Vipers",
  "team-davids":  "Legends",
  "team-greg":    'Larry "Bud" Melman123',
  "team-scottm":  "Xavier Musketeers",
};

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
      const [
        { data: picks },
        { data: stateData },
        { data: moves },
        { data: dbPlayers, error: playersError },
      ] = await Promise.all([
        supabase.from("draft_picks").select("*").order("overall", { ascending: true }),
        supabase.from("draft_state").select("complete").eq("id", 1).single(),
        supabase.from("roster_moves").select("*").order("created_at", { ascending: true }),
        supabase.from("players").select("*"),
      ]);

      if (!mounted) return;

      if (!picks || picks.length === 0) {
        // No draft picks yet — use Supabase players table as base
        const baseMap: Record<string, RosterPlayer[]> = {};

        if (dbPlayers && !playersError) {
          // Build from Supabase players table
          for (const p of dbPlayers as DbPlayer[]) {
            const teamName = TEAM_ID_TO_NAME[p.team_id];
            if (!teamName) continue;
            if (!baseMap[teamName]) baseMap[teamName] = [];
            baseMap[teamName].push({
              id: p.id,
              name: p.name,
              pos: p.position as RosterPlayer["pos"],
              nflTeam: p.nfl_team,
              byeWeek: p.bye_week || null,
              acquisition: p.draft_round ? "Draft" : "FA",
              round: p.draft_round ?? undefined,
            } as RosterPlayer & { round?: number });
          }
        } else {
          // Hard fallback to static wrcData if Supabase unreachable
          for (const team of TEAMS) {
            baseMap[team.teamName] = [...team.players];
          }
        }

        // Apply any waiver moves on top
        if (moves && moves.length > 0) {
          applyMoves(baseMap, moves as DbRosterMove[]);
        }

        setRostersByTeam(baseMap);
        setHasPicks(false);
        setDraftComplete(stateData?.complete ?? false);
        setLoading(false);
        return;
      }

      // Draft has started — build rosters from draft_picks
      const byTeam: Record<string, RosterPlayer[]> = {};

      for (const pick of picks as DbDraftPick[]) {
        if (!byTeam[pick.team_name]) byTeam[pick.team_name] = [];
        const poolPlayer = NFL_PLAYERS_2026.find(
          p => p.name.toLowerCase() === pick.player_name.toLowerCase()
        );
        byTeam[pick.team_name].push({
          id: makeId(),
          name: pick.player_name,
          pos: pick.player_pos as RosterPlayer["pos"],
          nflTeam: pick.player_nfl_team,
          byeWeek: poolPlayer?.bye ?? null,
          acquisition: "Draft",
          round: pick.round,
        } as RosterPlayer & { round?: number });
      }

      // For teams with no picks yet, fall back to Supabase players table
      if (dbPlayers && !playersError) {
        for (const p of dbPlayers as DbPlayer[]) {
          const teamName = TEAM_ID_TO_NAME[p.team_id];
          if (!teamName || byTeam[teamName]) continue; // skip if team already has picks
          if (!byTeam[teamName]) byTeam[teamName] = [];
          byTeam[teamName].push({
            id: p.id,
            name: p.name,
            pos: p.position as RosterPlayer["pos"],
            nflTeam: p.nfl_team,
            byeWeek: p.bye_week || null,
            acquisition: p.draft_round ? "Draft" : "FA",
            round: p.draft_round ?? undefined,
          } as RosterPlayer & { round?: number });
        }
      } else {
        // Hard fallback
        for (const team of TEAMS) {
          if (!byTeam[team.teamName]) {
            byTeam[team.teamName] = [...team.players];
          }
        }
      }

      // Apply waiver adds/drops on top
      if (moves && moves.length > 0) {
        applyMoves(byTeam, moves as DbRosterMove[]);
      }

      setRostersByTeam(byTeam);
      setHasPicks(true);
      setDraftComplete(stateData?.complete ?? false);
      setLoading(false);
    }

    load();

    // Subscribe to real-time changes
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
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
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
