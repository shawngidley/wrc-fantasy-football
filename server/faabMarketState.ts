/**
 * Free-agent market state, driven by the weekly FAAB cycle:
 *   - Tue 9am ET -> Sun 9am ET: normal FAAB bidding (blind bids, resolved
 *     automatically Thu 9am and Sun 9am)
 *   - Sun 9am ET -> Sun 1pm ET: open waiver window right after the Sunday
 *     award -- first-come-first-served instant adds, no FAAB cost
 *   - Sun 1pm ET -> Tue 9am ET: market closed entirely (no bids, no
 *     instant adds) while the bulk of that week's games are in progress
 *
 * The automated award itself (server/scheduledFaabAward.ts) runs at both
 * Thu and Sun 9am, but only the Sunday one triggers a state transition
 * here -- Thursday's award happens in the middle of an otherwise
 * continuous bidding window, not at a boundary between two different
 * states.
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

  if (weekday === "Sun") {
    if (hour < 9) return "bidding"; // still the window that started Thursday
    if (hour < 13) return "open_waiver";
    return "closed";
  }
  if (weekday === "Mon") return "closed";
  if (weekday === "Tue") return hour < 9 ? "closed" : "bidding";
  // Wed, Thu, Fri, Sat are all squarely within the ongoing bidding window
  return "bidding";
}
