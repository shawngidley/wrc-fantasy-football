import { describe, expect, it } from "vitest";
import { beatWeekMedian, officialWeekMedian } from "./weekMedian";

describe("officialWeekMedian", () => {
  it("returns the saved median once the week is final", () => {
    const rows = [
      { is_final: true, league_median: 123.3 },
      { is_final: true, league_median: 123.3 },
    ];
    expect(officialWeekMedian(rows)).toBe(123.3);
  });

  it("is null before the week is finalized, even if a stale value is sitting on the rows", () => {
    expect(officialWeekMedian([{ is_final: false, league_median: 118.2 }])).toBeNull();
  });

  it("treats a missing, zero, or non numeric median as not set yet", () => {
    expect(officialWeekMedian([{ is_final: true, league_median: null }])).toBeNull();
    expect(officialWeekMedian([{ is_final: true, league_median: 0 }])).toBeNull();
    expect(officialWeekMedian([{ is_final: true, league_median: Number.NaN }])).toBeNull();
  });

  it("is null for a week with no rows", () => {
    expect(officialWeekMedian([])).toBeNull();
  });

  it("uses a finalized row even when an earlier row for the week is not final", () => {
    const rows = [
      { is_final: false, league_median: null },
      { is_final: true, league_median: 131.45 },
    ];
    expect(officialWeekMedian(rows)).toBe(131.45);
  });
});

describe("beatWeekMedian", () => {
  it("is true only for a score strictly above the median", () => {
    expect(beatWeekMedian(130, 123.3)).toBe(true);
    expect(beatWeekMedian(100, 123.3)).toBe(false);
  });

  it("counts a score exactly at the median as a loss, matching how Standings award median wins", () => {
    expect(beatWeekMedian(123.3, 123.3)).toBe(false);
  });

  it("is null when there is no median or no score to compare", () => {
    expect(beatWeekMedian(130, null)).toBeNull();
    expect(beatWeekMedian(null, 123.3)).toBeNull();
    expect(beatWeekMedian(undefined, 123.3)).toBeNull();
    expect(beatWeekMedian(Number.NaN, 123.3)).toBeNull();
  });

  it("handles a zero score as a real score below the median", () => {
    expect(beatWeekMedian(0, 123.3)).toBe(false);
  });
});
