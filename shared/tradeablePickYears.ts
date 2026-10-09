/**
 * The draft years whose picks can still be traded. The 2026 draft is complete,
 * so its picks are spent and are neither offered nor accepted any more.
 *
 * Shared because the Trades page offers these years and proposeTrade validates
 * submissions against them. Held as separate literals on each side they drift
 * the moment one is bumped for a new season, and the server then rejects exactly
 * what the UI just offered.
 */
export const TRADEABLE_PICK_YEARS: readonly number[] = [2027];

/** The year the pick picker opens on. */
export const DEFAULT_TRADEABLE_PICK_YEAR = TRADEABLE_PICK_YEARS[0];

export function isTradeablePickYear(year: number): boolean {
  return TRADEABLE_PICK_YEARS.includes(year);
}
