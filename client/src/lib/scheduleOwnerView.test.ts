import { describe, expect, it } from "vitest";
import { SCHEDULE_2026 } from "@/lib/scheduleData2026";
import { getOwnerRegularSeasonWeeks } from "@/lib/scheduleOwnerView";

describe("getOwnerRegularSeasonWeeks", () => {
  it("returns all fourteen regular-season games for a valid owner", () => {
    const weeks = getOwnerRegularSeasonWeeks(SCHEDULE_2026, "Jonas");

    expect(weeks).toHaveLength(14);
    expect(weeks.every(week => week.type === "regular")).toBe(true);
    expect(weeks.every(week => week.matchups.some(matchup => matchup.includes("Jonas")))).toBe(true);
  });

  it("returns no schedule when no owner is authenticated", () => {
    expect(getOwnerRegularSeasonWeeks(SCHEDULE_2026, null)).toEqual([]);
  });
});
