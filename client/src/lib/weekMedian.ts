/**
 * The league median for a week, as the Schedule and Results page shows it.
 *
 * The number is the official one: weekly results finalization saves the median
 * of all 12 team scores on every weekly_results row for the week
 * (league_median). Reading it back, rather than recomputing from the scores on
 * screen, keeps this page identical to what Standings used to award median
 * wins and losses.
 */

export interface WeekResultMedianRow {
  is_final: boolean;
  league_median: number | null;
}

/**
 * The official median for a week's rows, or null until the week is final.
 * Only finalized rows count, and a missing, non numeric, or zero median is
 * treated as "not set yet", since a real median of 12 team scores is never 0.
 */
export function officialWeekMedian(rows: readonly WeekResultMedianRow[]): number | null {
  for (const row of rows) {
    if (!row.is_final) continue;
    const value = row.league_median;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

/**
 * Did this score beat the week's median? Same rule Standings uses to award a
 * median win: strictly greater than the median. A score exactly at the median
 * is a median loss. Returns null when there is nothing to compare yet.
 */
export function beatWeekMedian(score: number | null | undefined, median: number | null): boolean | null {
  if (median === null || score === null || score === undefined || !Number.isFinite(score)) return null;
  return score > median;
}
