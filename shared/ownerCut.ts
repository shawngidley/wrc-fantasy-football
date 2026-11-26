/**
 * Owner "Cut" rule: an owner may release one of their own players, with no
 * pickup, only while that player's week is still open.
 *
 * Open window: from the lineup week's start (Tuesday 9am ET, which is exactly
 * when getLineupDefaultWeek advances -- see its cutoff computation) until
 * 1:00 PM ET Sunday. From 1pm Sunday through Tuesday 9am the week that is
 * ending is locked, so a cut is refused; getLineupDefaultWeek still points at
 * that ending week then, and the server clears lineup rows from the default
 * week forward, so allowing a cut in that stretch would edit a week being
 * scored. (It also means a Monday night player can never be cut once Sunday
 * 1pm has passed.)
 *
 * On top of this the player's own NFL game must not have started that week --
 * that part needs kickoff data, so it lives in the server procedure.
 *
 * Read through Intl in America/New_York rather than a fixed offset, so the
 * window lands at 1pm and 9am local in both EDT and EST.
 */
export function isOwnerCutWindowOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  let hour = Number(parts.find(p => p.type === "hour")?.value ?? -1);
  if (hour >= 24) hour = 0; // some ICU builds emit "24" for midnight under hour12:false
  if (weekday === "Sun" && hour >= 13) return false;
  if (weekday === "Mon") return false;
  if (weekday === "Tue" && hour < 9) return false;
  return true;
}

export const OWNER_CUT_WINDOW_CLOSED_MESSAGE =
  "Cuts are closed from 1:00 PM ET Sunday until Tuesday 9:00 AM ET.";
