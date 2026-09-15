import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getCurrentWeek } from "./scheduleData2026";

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
