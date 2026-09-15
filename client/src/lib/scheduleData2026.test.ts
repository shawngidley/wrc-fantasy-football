import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getCurrentWeek, resolveWeeklyOpponentTeamName, isSeason2026Underway, getLineupDefaultWeek } from "./scheduleData2026";

describe("getCurrentWeek", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setNow(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it("returns 1 before the season starts", () => {
    setNow("2026-09-01T00:00:00Z");
    expect(getCurrentWeek()).toBe(1);
  });

  it("returns 1 during Week 1's Monday night, just past the old UTC-midnight boundary (the exact confirmed live bug)", () => {
    // Confirmed live: at this exact moment, the old implementation
    // incorrectly returned 17 (Super Bowl) instead of 1, since it
    // required the current time to fall within a week's listed range
    // rather than treating a started week as current through the gap
    // before the next week begins.
    setNow("2026-09-15T00:40:00Z");
    expect(getCurrentWeek()).toBe(1);
  });

  it("stays on Week 1 through the gap between Week 1 and Week 2 (the Tuesday/Wednesday before Thursday Night Football)", () => {
    setNow("2026-09-16T12:00:00Z");
    expect(getCurrentWeek()).toBe(1);
  });

  it("advances to Week 2 once Week 2's games have started", () => {
    setNow("2026-09-20T12:00:00Z");
    expect(getCurrentWeek()).toBe(2);
  });

  it("stays on Week 3 through the gap between Week 3 and Week 4", () => {
    setNow("2026-09-30T12:00:00Z");
    expect(getCurrentWeek()).toBe(3);
  });

  it("advances to Week 4 once Week 4 has started", () => {
    setNow("2026-10-01T00:00:01Z");
    expect(getCurrentWeek()).toBe(4);
  });

  it("returns 17 (Super Bowl) during and after Super Bowl week, never rolling over further", () => {
    setNow("2027-01-03T12:00:00Z");
    expect(getCurrentWeek()).toBe(17);
    setNow("2027-06-01T00:00:00Z");
    expect(getCurrentWeek()).toBe(17);
  });
});

describe("resolveWeeklyOpponentTeamName", () => {
  it("resolves the correct opponent for Week 1 (Vipers vs Xavier Musketeers, the real confirmed matchup)", () => {
    expect(resolveWeeklyOpponentTeamName("Vipers", 1)).toBe("Xavier Musketeers");
  });

  it("resolves correctly from the other side of the same matchup", () => {
    expect(resolveWeeklyOpponentTeamName("Xavier Musketeers", 1)).toBe("Vipers");
  });

  it("returns undefined for a null/undefined team name", () => {
    expect(resolveWeeklyOpponentTeamName(null, 1)).toBeUndefined();
    expect(resolveWeeklyOpponentTeamName(undefined, 1)).toBeUndefined();
  });

  it("returns undefined for a team name that doesn't match any known owner's team", () => {
    expect(resolveWeeklyOpponentTeamName("Not A Real Team", 1)).toBeUndefined();
  });

  it("returns undefined for a week number with no schedule data", () => {
    expect(resolveWeeklyOpponentTeamName("Vipers", 999)).toBeUndefined();
  });

  it("resolves a different, correct opponent for a different week", () => {
    // Week 2's actual matchups differ from Week 1's -- confirm the
    // resolution is genuinely week-specific, not just returning Week 1's
    // opponent regardless of the week argument.
    const week1Opponent = resolveWeeklyOpponentTeamName("Vipers", 1);
    const week2Opponent = resolveWeeklyOpponentTeamName("Vipers", 2);
    expect(week2Opponent).toBeDefined();
    expect(week2Opponent).not.toBe(week1Opponent);
  });
});

describe("isSeason2026Underway", () => {
  it("returns false before Week 1's kickoff", () => {
    expect(isSeason2026Underway(new Date("2026-09-08T23:59:59-04:00"))).toBe(false);
  });

  it("returns true at the exact moment of Week 1's kickoff", () => {
    expect(isSeason2026Underway(new Date("2026-09-09T00:00:00-04:00"))).toBe(true);
  });

  it("returns true well after the season has started", () => {
    expect(isSeason2026Underway(new Date("2026-09-15T12:00:00-04:00"))).toBe(true);
  });
});

describe("getLineupDefaultWeek", () => {
  // Confirmed live requirement: advances to the next week at 9am ET on
  // the Tuesday before that week starts -- distinct from getCurrentWeek(),
  // which other pages (Live Scoring, Standings) still use unchanged.

  it("stays on the prior week just before 9am ET on the Tuesday cutoff (EDT)", () => {
    // Week 2 starts Thursday Sept 17; its Tuesday cutoff is Sept 15, 9am ET (EDT, UTC-4) = 13:00 UTC.
    expect(getLineupDefaultWeek(new Date("2026-09-15T12:59:00Z"))).toBe(1);
  });

  it("advances to the next week at exactly 9am ET on the Tuesday cutoff (EDT)", () => {
    expect(getLineupDefaultWeek(new Date("2026-09-15T13:00:00Z"))).toBe(2);
  });

  it("stays on the new week shortly after the cutoff", () => {
    expect(getLineupDefaultWeek(new Date("2026-09-15T13:01:00Z"))).toBe(2);
  });

  it("correctly uses EST (not EDT) for a Tuesday cutoff after the 2026 DST transition", () => {
    // Week 9 starts Thursday Nov 5; its Tuesday cutoff is Nov 3, 9am ET
    // (EST by then, UTC-5) = 14:00 UTC, not 13:00 UTC as it would be under EDT.
    expect(getLineupDefaultWeek(new Date("2026-11-03T13:59:00Z"))).toBe(8); // still EDT-style 13:59 UTC -- not yet 9am EST
    expect(getLineupDefaultWeek(new Date("2026-11-03T14:00:00Z"))).toBe(9); // 9am EST
  });

  it("handles a Wednesday-starting week's cutoff correctly (the nearest prior Tuesday, not always 2 days before)", () => {
    // Week 12 starts Wednesday Nov 25 (a holiday-schedule shift) -- its
    // Tuesday cutoff is Nov 24 (one day before), not two days before as
    // every other, Thursday-starting week would compute. EST by then (UTC-5).
    expect(getLineupDefaultWeek(new Date("2026-11-24T13:59:00Z"))).toBe(11); // just before 9am EST
    expect(getLineupDefaultWeek(new Date("2026-11-24T14:00:00Z"))).toBe(12); // 9am EST
  });

  it("returns week 1 before the season's own first cutoff has passed", () => {
    expect(getLineupDefaultWeek(new Date("2026-08-01T12:00:00Z"))).toBe(1);
  });
});
