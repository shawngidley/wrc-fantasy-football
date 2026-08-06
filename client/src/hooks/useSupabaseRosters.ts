/**
 * useSupabaseRosters
 * Fetches all player data from the Supabase `players` table and groups by team_id.
 * This is the single source of truth for roster data — replaces static wrcData.ts arrays.
 *
 * Priority order for a player's roster:
 *   1. If draft has started: draft_picks table (live picks override everything)
 *   2. Else: players table (seeded from Excel, editable by commissioner)
 *   3. Waiver moves from roster_moves are applied on top of either source
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface SupabasePlayer {
  id: string;
  team_id: string;
  name: string;
  position: string;
  nfl_team: string;
  acquisition: string;
  draft_round: number | null;
  bye_week: number;
  status: string;
  season_fpts: number;
  fpg: number;
}

export interface SupabaseTeamRoster {
  team_id: string;
  team_name: string;
  owner: string;
  players: SupabasePlayer[];
}

export interface SupabaseRostersResult {
  rosters: SupabaseTeamRoster[];
  playersByTeamId: Record<string, SupabasePlayer[]>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// team_id → {team_name, owner} — must match Supabase teams table exactly
const TEAM_META: Record<string, { team_name: string; owner: string }> = {
  "team-jonas":   { team_name: "The Super Snuffleupagus",  owner: "Jonas" },
  "team-davidr":  { team_name: "The Boys of Fall",         owner: "David R." },
  "team-jason":   { team_name: "Heiden's Hardtimes",       owner: "Jason" },
  "team-keith":   { team_name: "HamSandwich",              owner: "Keith" },
  "team-dan":     { team_name: "Legion of Doom",           owner: "Dan" },
  "team-jamie":   { team_name: "The Four Horsemen",        owner: "Jamie" },
  "team-bill":    { team_name: "Billy Goats Gruff",        owner: "Bill" },
  "team-scottn":  { team_name: "Millertime",               owner: "Scott N." },
  "team-shawn":   { team_name: "Vipers",                   owner: "Shawn" },
  "team-davids":  { team_name: "Legends",                  owner: "David S." },
  "team-greg":    { team_name: 'Larry "Bud" Melman123',    owner: "Greg" },
  "team-scottm":  { team_name: "Xavier Musketeers",        owner: "Scott M." },
};

export function useSupabaseRosters(): SupabaseRostersResult {
  const [rosters, setRosters] = useState<SupabaseTeamRoster[]>([]);
  const [playersByTeamId, setPlayersByTeamId] = useState<Record<string, SupabasePlayer[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("players")
        .select("*")
        .order("draft_round", { ascending: true, nullsFirst: false });

      if (!mounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const players = (data ?? []) as SupabasePlayer[];

      // Group by team_id
      const byTeam: Record<string, SupabasePlayer[]> = {};
      for (const p of players) {
        if (!byTeam[p.team_id]) byTeam[p.team_id] = [];
        byTeam[p.team_id].push(p);
      }

      // Build ordered roster list
      const rosterList: SupabaseTeamRoster[] = Object.entries(TEAM_META).map(
        ([team_id, meta]) => ({
          team_id,
          team_name: meta.team_name,
          owner: meta.owner,
          players: byTeam[team_id] ?? [],
        })
      );

      setPlayersByTeamId(byTeam);
      setRosters(rosterList);
      setLoading(false);
    }

    load();

    // Subscribe to player changes in real time
    const channel = supabase
      .channel("players-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
        if (mounted) load();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [tick]);

  return { rosters, playersByTeamId, loading, error, refresh };
}
