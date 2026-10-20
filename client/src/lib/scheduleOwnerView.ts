import type { ScheduleWeek } from "@/lib/scheduleData2026";

export function getOwnerRegularSeasonWeeks(schedule: ScheduleWeek[], owner: string | null) {
  if (!owner) return [];
  return schedule.filter(week =>
    week.type === "regular" && week.matchups.some(([ownerA, ownerB]) => ownerA === owner || ownerB === owner),
  );
}

/**
 * Which owner's schedule to show: the one picked in the dropdown, or the
 * logged-in owner by default. A pick that is not a real owner is ignored.
 */
export function resolveViewedOwner(
  picked: string | null,
  myOwner: string | null,
  ownerToTeam: Record<string, string>,
): string | null {
  if (picked && Object.prototype.hasOwnProperty.call(ownerToTeam, picked)) return picked;
  return myOwner;
}

/** Dropdown options: the logged-in owner first (marked "My schedule"), then the rest by team name. */
export function getScheduleOwnerOptions(
  ownerToTeam: Record<string, string>,
  myOwner: string | null,
): { owner: string; label: string }[] {
  const others = Object.entries(ownerToTeam)
    .filter(([owner]) => owner !== myOwner)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([owner, team]) => ({ owner, label: `${team} (${owner})` }));
  if (myOwner && Object.prototype.hasOwnProperty.call(ownerToTeam, myOwner)) {
    return [{ owner: myOwner, label: `My schedule · ${ownerToTeam[myOwner]}` }, ...others];
  }
  return others;
}
