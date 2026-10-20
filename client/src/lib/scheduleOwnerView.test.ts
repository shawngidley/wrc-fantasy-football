import { describe, expect, it } from "vitest";
import { OWNER_TO_TEAM, SCHEDULE_2026 } from "@/lib/scheduleData2026";
import { getOwnerRegularSeasonWeeks, getScheduleOwnerOptions, resolveViewedOwner } from "@/lib/scheduleOwnerView";

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

describe("resolveViewedOwner", () => {
  it("defaults to my own schedule", () => {
    expect(resolveViewedOwner(null, "Jonas", OWNER_TO_TEAM)).toBe("Jonas");
  });
  it("shows the picked team", () => {
    expect(resolveViewedOwner("Bill", "Jonas", OWNER_TO_TEAM)).toBe("Bill");
  });
  it("ignores a pick that is not a real owner", () => {
    expect(resolveViewedOwner("Nobody", "Jonas", OWNER_TO_TEAM)).toBe("Jonas");
  });
  // An inherited Object.prototype key is not an owner either. A plain
  // `picked in ownerToTeam` would accept these and the page would then render
  // a header for "constructor" with an empty 0-game schedule.
  it("ignores an inherited object key", () => {
    expect(resolveViewedOwner("constructor", "Jonas", OWNER_TO_TEAM)).toBe("Jonas");
    expect(resolveViewedOwner("toString", "Jonas", OWNER_TO_TEAM)).toBe("Jonas");
  });
});

describe("getScheduleOwnerOptions", () => {
  it("lists all twelve teams with mine first", () => {
    const options = getScheduleOwnerOptions(OWNER_TO_TEAM, "Jonas");
    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({ owner: "Jonas", label: "My schedule · The Super Snuffleupagus" });
    expect(new Set(options.map(o => o.owner)).size).toBe(12);
  });
  it("gives every owner a full fourteen game schedule to switch to", () => {
    for (const { owner } of getScheduleOwnerOptions(OWNER_TO_TEAM, "Jonas")) {
      expect(getOwnerRegularSeasonWeeks(SCHEDULE_2026, owner)).toHaveLength(14);
    }
  });
});
