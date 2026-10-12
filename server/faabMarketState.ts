/**
 * Free-agent market state, driven by the weekly FAAB cycle:
 *   - Sun 9am ET -> Sun 1pm ET: open waiver window right after the Sunday
 *     award -- first-come-first-served instant adds, no FAAB cost
 *   - Every other hour: FAAB bidding (blind bids, resolved automatically
 *     Thu 9am and Sun 9am)
 *
 * Bidding is now open continuously except during that Sunday open-waiver
 * window -- including Sun 1pm through Tue 9am, which used to be a hard
 * "closed" window while the week's games played out. Bids placed from 1pm
 * Sunday on are for NEXT week (getFaabBiddingWeek bumps the week), and the
 * per-player kickoff lock is checked against that upcoming week -- whose
 * games haven't started -- so every free agent is biddable and the award
 * lands the following Thursday 9am. There is no longer a "closed" state;
 * the enum value is kept for compatibility with existing callers.
 *
 * The automated award itself (server/scheduledFaabAward.ts) runs at both
 * Thu and Sun 9am. Only the Sunday 9am -> open_waiver -> 1pm bidding
 * sequence is a visible state transition here; Thursday's award happens in
 * the middle of an otherwise continuous bidding window.
 */

export type FreeAgentMarketState = "bidding" | "open_waiver" | "closed";

export function getFreeAgentMarketState(now = new Date()): FreeAgentMarketState {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? -1);

  if (weekday === "Sun" && hour >= 9 && hour < 13) return "open_waiver";
  // Everything else is bidding. From 1pm Sunday through Tue 9am the bids are
  // for next week (see getFaabBiddingWeek); the rest of the week they're for
  // the current week. Either way the market is open.
  return "bidding";
}
