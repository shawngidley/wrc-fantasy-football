/**
 * NFL kickoff instants from Tank01's Eastern date and time strings.
 *
 * Tank01 gives a gameDate like "20261101" and a gameTime like "1:00p", both in
 * US Eastern. The code that read them assumed Eastern Daylight Time (UTC-4)
 * for every game, which is right through the first Sunday of November and an
 * hour wrong after the clocks go back (Eastern Standard Time is UTC-5).
 * A game computed an hour early locks players, and stops polling live scores,
 * an hour too soon.
 *
 * This works out the real offset for that date with Intl, so it is correct on
 * both sides of the change without a hard coded cutover date.
 */

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
});

/** The Eastern wall clock reading at an instant, expressed as if it were UTC. */
function easternWallClockAsUTC(instant: Date): number {
  const parts = Object.fromEntries(ET_PARTS.formatToParts(instant).map(p => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
}

/** Kickoff as a real instant, or null if the date or time can't be read. */
export function parseEasternKickoffToUTC(gameDate: string | undefined, gameTime: string | undefined): Date | null {
  if (!gameDate || !gameTime || gameDate.length < 8) return null;
  const year = parseInt(gameDate.slice(0, 4), 10);
  const month = parseInt(gameDate.slice(4, 6), 10) - 1; // Date.UTC months are 0 indexed
  const day = parseInt(gameDate.slice(6, 8), 10);
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch || [year, month, day].some(Number.isNaN)) return null;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;

  // Date.UTC rolls hour overflow into the next day (an 8:20pm ET kickoff is
  // hour 24 or later in UTC), which an ISO string like "T24:20:00Z" cannot.
  const wallClockAsUTC = Date.UTC(year, month, day, hours, mins);
  const guess = new Date(wallClockAsUTC + 4 * 3_600_000); // assume EDT, then correct
  const offsetMs = guess.getTime() - easternWallClockAsUTC(guess); // real UTC minus Eastern wall clock: 4h in EDT, 5h in EST
  const kickoff = new Date(wallClockAsUTC + offsetMs);
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
}

export function hasEasternKickoffPassed(gameDate: string | undefined, gameTime: string | undefined, now: number = Date.now()): boolean {
  const kickoff = parseEasternKickoffToUTC(gameDate, gameTime);
  return kickoff !== null && now >= kickoff.getTime();
}
