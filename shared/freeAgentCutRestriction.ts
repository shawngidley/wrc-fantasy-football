/**
 * Free-agent waiver timing.
 *
 * A cut player sits on waivers for a 48-hour hold. During that hold they
 * cannot be free-added in the Sunday open-waiver window, and a FAAB bid on
 * them is not awarded. But a bid CAN be placed the moment a player is cut (as
 * long as the market is open for bidding) -- the hold is enforced at AWARD
 * time, not bid time. A bid is awarded at the first FAAB award (Thursday 9am
 * ET or Sunday 9am ET) that falls at least 48 hours after the cut.
 *
 * Examples:
 *  - Cut Thursday 9am ET -> awarded Sunday 9am ET (72h; the Thursday award is
 *    at the cut moment, so the next award is Sunday).
 *  - Cut Sunday 9am ET -> awarded Thursday 9am ET (bidding reopens Tuesday, the
 *    48h clears Tuesday, and the next award after that is Thursday).
 *  - Cut Wednesday 2pm ET -> awarded Sunday 9am ET (48h clears Friday, and the
 *    next award after that is Sunday).
 */

export const WAIVER_HOLD_MS = 48 * 60 * 60 * 1000;

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** 9am ET on a specific ET calendar date, correctly handling EDT/EST via Intl
 * rather than a hardcoded UTC offset. */
function etDateAt9am(year: number, month: number, day: number): Date {
  // Start with an EDT guess (UTC-4); adjust by the actual observed offset in
  // case this date falls in EST (UTC-5). The gap is always exactly one hour.
  const guess = new Date(Date.UTC(year, month - 1, day, 13, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).formatToParts(guess);
  const observedHour = Number(parts.find(p => p.type === "hour")?.value ?? 9);
  const hourDiff = observedHour - 9;
  return new Date(guess.getTime() - hourDiff * 60 * 60 * 1000);
}

/** The next FAAB award moment (Thursday 9am ET or Sunday 9am ET) at or after
 * `from`. These are the two weekly award windows (see scheduledFaabAward.ts). */
export function nextFaabAwardAfter(from: Date): Date {
  // Max real gap between Thu and Sun awards is 4 days, so 8 is a safe margin.
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const candidate = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(candidate);
    const weekday = parts.find(p => p.type === "weekday")?.value;
    if (weekday !== "Thu" && weekday !== "Sun") continue;
    const year = Number(parts.find(p => p.type === "year")?.value);
    const month = Number(parts.find(p => p.type === "month")?.value);
    const day = Number(parts.find(p => p.type === "day")?.value);
    const boundary = etDateAt9am(year, month, day);
    if (boundary.getTime() >= from.getTime()) return boundary;
  }
  return from;
}

/** Has a player cut at droppedAt cleared the 48-hour waiver hold as of `now`?
 * A null droppedAt (never cut, or cut long ago) is always cleared. Used for
 * the Sunday free-pickup gate and the award-time gate. */
export function hasClearedWaiverHold(droppedAt: Date | string | null, now: Date = new Date()): boolean {
  if (!droppedAt) return true;
  return now.getTime() >= toDate(droppedAt).getTime() + WAIVER_HOLD_MS;
}

/** When a bid on a player cut at droppedAt would be awarded: the first FAAB
 * award (Thu/Sun 9am ET) at least 48 hours after the cut. For a player not
 * recently cut, just the next award. `now` guards a stale past cut. */
export function getFaabAwardDate(droppedAt: Date | string | null, now: Date = new Date()): Date {
  const clearedAt = droppedAt ? new Date(toDate(droppedAt).getTime() + WAIVER_HOLD_MS) : now;
  const from = clearedAt.getTime() > now.getTime() ? clearedAt : now;
  return nextFaabAwardAfter(from);
}
