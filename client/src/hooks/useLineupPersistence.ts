/**
 * useLineupPersistence — saves and loads a team's weekly lineup to/from Supabase.
 *
 * The `lineups` table stores one row per slot per team per week.
 * On load, returns the saved slot→playerId mapping so Lineup.tsx can
 * re-order starters/bench to match what the owner last saved.
 * On save, upserts all starter and bench rows atomically.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export interface LineupRow {
  team_id: string;
  week: number;
  season: number;
  slot: string;       // e.g. "QB", "RB1", "BENCH_0" …
  player_id: string;
  player_name: string;
  is_bench: boolean;
}

/** Map of slot → player_name for quick lookup (name is stable across pre-draft/post-draft) */
export type SavedLineupMap = Record<string, string>;

interface UseLineupPersistenceResult {
  savedLineup: SavedLineupMap | null;
  loadingLineup: boolean;
  saveLineup: (rows: Omit<LineupRow, "team_id" | "week" | "season">[]) => Promise<boolean>;
  saveError: string | null;
  saving: boolean;
}

export function useLineupPersistence(
  teamId: string | null | undefined,
  week: number,
  season = 2026
): UseLineupPersistenceResult {
  const saveMutation = trpc.lineups.save.useMutation();
  const [savedLineup, setSavedLineup] = useState<SavedLineupMap | null>(null);
  const [loadingLineup, setLoadingLineup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load saved lineup on mount / when teamId/week changes
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function load() {
      setLoadingLineup(true);
      try {
        const { data, error } = await supabase
          .from("lineups")
          .select("slot, player_name")
          .eq("team_id", teamId!)
          .eq("week", week)
          .eq("season", season);

        if (error) throw error;
        if (!cancelled && data && data.length > 0) {
          const map: SavedLineupMap = {};
          for (const row of data) {
            map[row.slot] = row.player_name; // slot → player name
          }
          setSavedLineup(map);
        } else if (!cancelled) {
          setSavedLineup(null); // no saved lineup yet
        }
      } catch (err) {
        console.error("Failed to load saved lineup:", err);
        if (!cancelled) setSavedLineup(null);
      } finally {
        if (!cancelled) setLoadingLineup(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [teamId, week, season]);

  const saveLineup = useCallback(
    async (rows: Omit<LineupRow, "team_id" | "week" | "season">[]): Promise<boolean> => {
      if (!teamId) {
        console.error("[useLineupPersistence] saveLineup called with no teamId");
        return false;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const upsertRows: LineupRow[] = rows.map(r => ({
          ...r,
          team_id: teamId,
          week,
          season,
        }));

        console.log("[useLineupPersistence] upserting", upsertRows.length, "rows for", teamId, "week", week);
        await saveMutation.mutateAsync({ teamId, week, season, rows });

        // Update local state so UI reflects saved state (keyed by player_name)
        const map: SavedLineupMap = {};
        for (const r of upsertRows) {
          map[r.slot] = r.player_name;
        }
        setSavedLineup(map);
        console.log("[useLineupPersistence] saved successfully");
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save lineup";
        setSaveError(msg);
        console.error("Failed to save lineup:", err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [teamId, week, season, saveMutation]
  );

  return { savedLineup, loadingLineup, saveLineup, saveError, saving };
}
