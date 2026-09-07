import { describe, expect, it } from "vitest";
import { isFaabAwardWindow, shouldProcessFaabAwardNow } from "./scheduledFaabAward";

describe("isFaabAwardWindow", () => {
  // September 13, 2026 is a Sunday; September 17 is a Thursday. EDT is
  // UTC-4 during this part of the season, so 9am ET = 13:00 UTC.
  it("is true at 9am ET on Sunday", () => {
    expect(isFaabAwardWindow(new Date("2026-09-13T13:00:00Z"))).toBe(true);
  });

  it("is true at 9am ET on Thursday", () => {
    expect(isFaabAwardWindow(new Date("2026-09-17T13:15:00Z"))).toBe(true);
  });

  it("is false at 8am or 10am ET on an award day", () => {
    expect(isFaabAwardWindow(new Date("2026-09-13T12:00:00Z"))).toBe(false); // 8am ET
    expect(isFaabAwardWindow(new Date("2026-09-13T14:00:00Z"))).toBe(false); // 10am ET
  });

  it("is false at 9am ET on a non-award day (e.g. Tuesday)", () => {
    expect(isFaabAwardWindow(new Date("2026-09-15T13:00:00Z"))).toBe(false); // Tuesday
  });

  it("correctly handles the EST side of the DST transition (9am ET = 14:00 UTC)", () => {
    // December 6, 2026 is a Sunday, well after DST ends (Nov 1, 2026).
    expect(isFaabAwardWindow(new Date("2026-12-06T14:00:00Z"))).toBe(true);
    // The EDT-era UTC time (13:00) is now 8am ET, not 9am -- must be false.
    expect(isFaabAwardWindow(new Date("2026-12-06T13:00:00Z"))).toBe(false);
  });
});

describe("shouldProcessFaabAwardNow", () => {
  it("processes the first award on Sunday September 13, 2026 at 9am ET", () => {
    expect(shouldProcessFaabAwardNow(new Date("2026-09-13T13:00:00Z"))).toBe(true);
  });

  it("does not process on a Thursday before the automation start date, even at 9am ET", () => {
    // Thursday September 10, 2026 -- before Sept 13, so no award yet even
    // though the time-of-day/day-of-week check alone would otherwise pass.
    expect(shouldProcessFaabAwardNow(new Date("2026-09-10T13:00:00Z"))).toBe(false);
  });

  it("processes the first Thursday award on September 17, 2026 at 9am ET", () => {
    // The single Sept 13 automation-start guard covers this automatically,
    // since Sept 17 is simply the next Thu/Sun after Sept 13 -- no
    // separate Thursday-specific start date needed.
    expect(shouldProcessFaabAwardNow(new Date("2026-09-17T13:00:00Z"))).toBe(true);
  });

  it("continues processing on subsequent Sunday and Thursday awards", () => {
    expect(shouldProcessFaabAwardNow(new Date("2026-09-20T13:00:00Z"))).toBe(true); // Sun Sept 20
    expect(shouldProcessFaabAwardNow(new Date("2026-09-24T13:00:00Z"))).toBe(true); // Thu Sept 24
  });
});
