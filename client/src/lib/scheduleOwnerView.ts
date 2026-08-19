import type { ScheduleWeek } from "@/lib/scheduleData2026";

export function getOwnerRegularSeasonWeeks(schedule: ScheduleWeek[], owner: string | null) {
  if (!owner) return [];
  return schedule.filter(week =>
    week.type === "regular" && week.matchups.some(([ownerA, ownerB]) => ownerA === owner || ownerB === owner),
  );
}
