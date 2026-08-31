/**
 * useLineupPersistence — saves and loads a team's weekly lineup to/from Supabase.
 *
 * The `lineups` table stores one row per slot per team per week.
 * On load, returns the saved slot→playerId mapping so Lineup.tsx can
 * re-order starters/bench to match what the owner last saved.
 * On save, upserts all starter and bench rows atomically.
 */
import { useState, useEffect, useCallback } from "react";
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
  season = 2026,
  asCommissioner = false,
): UseLineupPersistenceResult {
  const [savedLineup, setSavedLineup] = useState<SavedLineupMap | null>(null);
  const [loadingLineup, setLoadingLineup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedLineupQuery = trpc.league.lineups.useQuery(
    { teamId: teamId ?? "", week, season },
    { enabled: Boolean(teamId), staleTime: 30_000 },
  );
  const saveLineupMutation = trpc.league.saveLineup.useMutation();
  const commissionerSaveLineupMutation = trpc.league.commissionerSaveLineup.useMutation();

  // Load saved lineup on mount / when teamId/week changes
  useEffect(() => {
    setLoadingLineup(savedLineupQuery.isLoading || savedLineupQuery.isFetching);
    const rows = savedLineupQuery.data ?? [];
    if (rows.length > 0) {
      const map: SavedLineupMap = {};
      for (const row of rows) map[row.slot] = row.player_name;
      setSavedLineup(map);
    } else if (!savedLineupQuery.isLoading) {
      setSavedLineup(null);
    }
  }, [savedLineupQuery.data, savedLineupQuery.isFetching, savedLineupQuery.isLoading]);

  const saveLineup = useCallback(
    async (rows: Omit<LineupRow, "team_id" | "week" | "season">[]): Promise<boolean> => {
      if (!teamId) {
        console.error("[useLineupPersistence] saveLineup called with no teamId");
        return false;
      }
      setSaving(true);
      setSaveError(null);
      try {
        // saveLineup (teamProcedure) always writes to the caller's own
        // authenticated team, ignoring any teamId passed in -- it can't be
        // used to edit someone else's lineup even client-side. The
        // commissioner-only endpoint takes an explicit teamId instead, so
        // the commissioner can set any team's lineup on their behalf.
        if (asCommissioner) {
          await commissionerSaveLineupMutation.mutateAsync({ teamId, week, season, rows });
        } else {
          await saveLineupMutation.mutateAsync({ week, season, rows });
        }

        // Update local state so UI reflects saved state (keyed by player_name)
        const map: SavedLineupMap = {};
        for (const r of rows) {
          map[r.slot] = r.player_name;
        }
        setSavedLineup(map);
        await savedLineupQuery.refetch();
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
    [teamId, week, season, asCommissioner, saveLineupMutation, commissionerSaveLineupMutation, savedLineupQuery]
  );

  return { savedLineup, loadingLineup, saveLineup, saveError, saving };
}
