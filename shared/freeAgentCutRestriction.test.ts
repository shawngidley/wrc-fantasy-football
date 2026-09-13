import { describe, expect, it } from "vitest";
import { getFreeAgentEligibleDate, isEligibleAfterCut } from "./freeAgentCutRestriction";

describe("getFreeAgentEligibleDate", () => {
  it("a player dropped Thursday 9am ET is eligible Sunday 9am ET (the confirmed example: 72 hours, not 48)", () => {
    // Thursday Sept 10, 2026, 9:00am ET = 13:00 UTC (EDT)
    const droppedAt = new Date("2026-09-10T13:00:00Z");
    const eligible = getFreeAgentEligibleDate(droppedAt);
    // Expected: Sunday Sept 13, 2026, 9:00am ET = 13:00 UTC
    expect(eligible.toISOString()).toBe("2026-09-13T13:00:00.000Z");
  });

  it("a player dropped Sunday 9am ET is eligible Tuesday 9am ET (the confirmed example: exactly 48 hours)", () => {
    // Sunday Sept 13, 2026, 9:00am ET = 13:00 UTC
    const droppedAt = new Date("2026-09-13T13:00:00Z");
    const eligible = getFreeAgentEligibleDate(droppedAt);
    // Expected: Tuesday Sept 15, 2026, 9:00am ET = 13:00 UTC
    expect(eligible.toISOString()).toBe("2026-09-15T13:00:00.000Z");
  });

  it("a player dropped Tuesday 9am ET (right at a boundary) is eligible the following Sunday", () => {
    // Tuesday Sept 15, 2026, 9:00am ET
    const droppedAt = new Date("2026-09-15T13:00:00Z");
    const eligible = getFreeAgentEligibleDate(droppedAt);
    // 48h later = Thursday 9am, next boundary at/after that = Sunday Sept 20
    expect(eligible.toISOString()).toBe("2026-09-20T13:00:00.000Z");
  });

  it("a player dropped Saturday 9am ET is eligible the following Tuesday", () => {
    // Saturday Sept 12, 2026, 9:00am ET
    const droppedAt = new Date("2026-09-12T13:00:00Z");
    const eligible = getFreeAgentEligibleDate(droppedAt);
    // 48h later = Monday 9am, next boundary at/after that = Tuesday Sept 15
    expect(eligible.toISOString()).toBe("2026-09-15T13:00:00.000Z");
  });

  it("a player dropped just before a boundary still has to wait for the NEXT one, not the immediate one, if 48h hasn't passed", () => {
    // Saturday Sept 12, 2026, 11:00pm ET -- 48h later is Monday 11pm,
    // well past Sunday 9am, so next boundary is Tuesday, not Sunday.
    const droppedAt = new Date("2026-09-13T03:00:00Z"); // Sat 11pm ET
    const eligible = getFreeAgentEligibleDate(droppedAt);
    expect(eligible.toISOString()).toBe("2026-09-15T13:00:00.000Z");
  });
});

describe("isEligibleAfterCut", () => {
  it("returns true for a null droppedAt (never cut)", () => {
    expect(isEligibleAfterCut(null)).toBe(true);
  });

  it("returns false before the eligible moment", () => {
    const droppedAt = new Date("2026-09-10T13:00:00Z"); // Thu 9am ET
    const justBefore = new Date("2026-09-13T12:59:00Z"); // 1 min before Sun 9am ET
    expect(isEligibleAfterCut(droppedAt, justBefore)).toBe(false);
  });

  it("returns true at and after the eligible moment", () => {
    const droppedAt = new Date("2026-09-10T13:00:00Z"); // Thu 9am ET
    const exactMoment = new Date("2026-09-13T13:00:00Z"); // Sun 9am ET exactly
    const after = new Date("2026-09-13T14:00:00Z");
    expect(isEligibleAfterCut(droppedAt, exactMoment)).toBe(true);
    expect(isEligibleAfterCut(droppedAt, after)).toBe(true);
  });

  it("accepts a string timestamp (as stored in the database) as well as a Date", () => {
    expect(isEligibleAfterCut("2026-09-10T13:00:00Z", new Date("2026-09-13T13:00:00Z"))).toBe(true);
    expect(isEligibleAfterCut("2026-09-10T13:00:00Z", new Date("2026-09-13T12:00:00Z"))).toBe(false);
  });
});
