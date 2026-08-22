import { useCallback } from "react";
import { type NFLMatchupMap } from "@/hooks/useNFLMatchups";

/**
 * Weekly settlement is intentionally server-controlled. A scheduled secure job
 * detects finalized NFL games and writes WRC results; browsers never settle scores.
 */
export function useWeeklyResultsWriter(
  _week: number,
  _season: number,
  _matchupMap: NFLMatchupMap,
  _enabled = true,
): {
  autoWriteStatus: "idle" | "running" | "done" | "error";
  autoWriteError: string | null;
  forceWriteResults: (_targetWeek: number, _targetSeason?: number) => Promise<void>;
} {
  const forceWriteResults = useCallback(async (_targetWeek: number, _targetSeason = 2026) => {
    throw new Error("Weekly results are finalized automatically after all NFL games are final.");
  }, []);
  const autoWriteStatus: "idle" | "running" | "done" | "error" = "idle";
  return { autoWriteStatus, autoWriteError: null, forceWriteResults };
}
