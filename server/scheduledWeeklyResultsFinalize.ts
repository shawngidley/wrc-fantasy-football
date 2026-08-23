import type { Request, Response } from "express";
import { getCurrentWeek } from "../client/src/lib/scheduleData2026";
import { supabaseAdmin } from "./supabaseAdmin";
import { finalizeWeeklyResultsFromTank } from "./weeklyResultsFinalize";

const SEASON = 2026;

export async function autoFinalizeCompletedWeeklyResults() {
  const currentWeek = getCurrentWeek();
  const { data: unsettledRows, error } = await supabaseAdmin
    .from("weekly_results")
    .select("week")
    .eq("season", SEASON)
    .eq("is_final", false)
    .lte("week", currentWeek);
  if (error) throw new Error("Unable to find unsettled weekly results.");

  const candidateWeeks = Array.from(new Set((unsettledRows ?? []).map(row => Number(row.week))))
    .filter(week => Number.isInteger(week) && week >= 1 && week <= 17)
    .sort((a, b) => a - b);
  const finalizedWeeks: number[] = [];
  const pendingWeeks: number[] = [];

  for (const week of candidateWeeks) {
    try {
      await finalizeWeeklyResultsFromTank(week, SEASON);
      finalizedWeeks.push(week);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not all final yet/i.test(message)) {
        pendingWeeks.push(week);
        continue;
      }
      throw error;
    }
  }

  return { season: SEASON, currentWeek, finalizedWeeks, pendingWeeks };
}

export async function finalizeWeeklyResultsSchedule(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ ok: true, ...(await autoFinalizeCompletedWeeklyResults()) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { finalization: "weekly-results" },
    });
  }
}
