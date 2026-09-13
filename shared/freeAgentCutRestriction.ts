/**
 * A cut/dropped player must wait at least 48 hours, then becomes eligible
 * to be bid on or instantly added at the next Sunday 9am ET or Tuesday
 * 9am ET market-cycle boundary (the same boundaries already governing the
 * FAAB/open-waiver cycle in faabMarketState.ts) -- not a flat 48-hour
 * timer. Confirmed with two examples: a player dropped Thursday 9am ET
 * is eligible Sunday 9am ET (72 hours later, since that's the next
 * boundary at or after the 48-hour mark); a player dropped Sunday 9am ET
 * is eligible Tuesday 9am ET (exactly 48 hours later, since that itself
 * is a boundary).
 */

/** 9am ET on a specific ET calendar date, correctly handling EDT/EST via
 * Intl rather than a hardcoded UTC offset. */
function etDateAt9am(year: number, month: number, day: number): Date {
  // Start with an EDT guess (UTC-4); adjust by the actual observed
  // offset difference in case this date falls in EST (UTC-5) instead --
  // the gap is always exactly one hour, so a single correction suffices.
  const guess = new Date(Date.UTC(year, month - 1, day, 13, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).formatToParts(guess);
  const observedHour = Number(parts.find(p => p.type === "hour")?.value ?? 9);
  const hourDiff = observedHour - 9;
  return new Date(guess.getTime() - hourDiff * 60 * 60 * 1000);
}

/** Returns the exact moment a player dropped at droppedAt becomes
 * eligible to be picked up again. */
export function getFreeAgentEligibleDate(droppedAt: Date): Date {
  const minEligibleTime = new Date(droppedAt.getTime() + 48 * 60 * 60 * 1000);
  // Search forward day by day for the next Sunday 9am ET or Tuesday 9am
  // ET at or after minEligibleTime. Max real gap between boundaries is
  // Tue->Sun (5 days), so 8 is a safe margin.
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const candidateDay = new Date(minEligibleTime.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(candidateDay);
    const weekday = parts.find(p => p.type === "weekday")?.value;
    if (weekday !== "Sun" && weekday !== "Tue") continue;
    const year = Number(parts.find(p => p.type === "year")?.value);
    const month = Number(parts.find(p => p.type === "month")?.value);
    const day = Number(parts.find(p => p.type === "day")?.value);
    const boundary = etDateAt9am(year, month, day);
    if (boundary.getTime() >= minEligibleTime.getTime()) return boundary;
  }
  // Should never be reached given the search window above; fail toward
  // the later, safer time rather than an arbitrary guess.
  return minEligibleTime;
}

/** Returns true if a player dropped at droppedAt is eligible to be
 * picked up again as of `now`. A null droppedAt (never dropped, or
 * dropped so long ago it's not worth tracking) is always eligible. */
export function isEligibleAfterCut(droppedAt: Date | string | null, now = new Date()): boolean {
  if (!droppedAt) return true;
  const dropDate = typeof droppedAt === "string" ? new Date(droppedAt) : droppedAt;
  return now.getTime() >= getFreeAgentEligibleDate(dropDate).getTime();
}
