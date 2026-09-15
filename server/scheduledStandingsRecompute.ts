import type { Request, Response } from "express";
import { recomputeStandingsFromFinalizedResults } from "./weeklyResultsFinalize";

const SEASON = 2026;

/**
 * TEMPORARY: force-recomputes every team's standings from all already-
 * finalized weekly_results, regardless of whether a given week is
 * already marked is_final. The regular weekly-results-finalize endpoint
 * only processes weeks NOT yet final, so it can't be used to re-apply a
 * fix (a scoring rule change, a division correction) to a week that
 * already went final before that fix existed. This endpoint exists
 * purely as a manually-triggered escape hatch for exactly that
 * situation -- remove once no longer needed.
 */
export async function recomputeStandingsSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const result = await recomputeStandingsFromFinalizedResults(SEASON);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[recomputeStandingsSchedule] failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { finalization: "standings-recompute" },
    });
  }
}
