import { describe, expect, it } from "vitest";
import { hasEasternKickoffPassed, parseEasternKickoffToUTC } from "./nflKickoffTime";

const iso = (d: string, t: string) => parseEasternKickoffToUTC(d, t)?.toISOString();

describe("parseEasternKickoffToUTC", () => {
  it("uses UTC-4 while Eastern Daylight Time is in effect", () => {
    expect(iso("20261025", "1:00p")).toBe("2026-10-25T17:00:00.000Z");
    expect(iso("20261101", "1:00a")).toBeDefined();
  });

  it("uses UTC-5 once the clocks have gone back (Sunday Nov 1, 2026)", () => {
    expect(iso("20261101", "1:00p")).toBe("2026-11-01T18:00:00.000Z");
    expect(iso("20261102", "8:15p")).toBe("2026-11-03T01:15:00.000Z");
    expect(iso("20261129", "4:25p")).toBe("2026-11-29T21:25:00.000Z");
  });

  it("is correct on the Thursday before and the Sunday of the change", () => {
    expect(iso("20261029", "8:15p")).toBe("2026-10-30T00:15:00.000Z"); // EDT
    expect(iso("20261101", "9:30a")).toBe("2026-11-01T14:30:00.000Z"); // EST (London game)
  });

  it("rolls a late kickoff into the next UTC day", () => {
    expect(iso("20261018", "8:20p")).toBe("2026-10-19T00:20:00.000Z");
  });

  it("is correct when daylight time starts again in the spring", () => {
    expect(iso("20270314", "1:00p")).toBe("2027-03-14T17:00:00.000Z");
    expect(iso("20270307", "1:00p")).toBe("2027-03-07T18:00:00.000Z");
  });

  it("handles 12pm and 12am", () => {
    expect(iso("20261101", "12:00p")).toBe("2026-11-01T17:00:00.000Z");
    expect(iso("20261025", "12:00p")).toBe("2026-10-25T16:00:00.000Z");
  });

  it("returns null for anything it cannot read", () => {
    expect(parseEasternKickoffToUTC(undefined, "1:00p")).toBeNull();
    expect(parseEasternKickoffToUTC("20261101", undefined)).toBeNull();
    expect(parseEasternKickoffToUTC("2026", "1:00p")).toBeNull();
    expect(parseEasternKickoffToUTC("20261101", "TBD")).toBeNull();
  });

  // Every 2026 regular-season Sunday 1pm ET kickoff, so the EDT/EST boundary is
  // covered by the real schedule rather than only the two dates picked above.
  it("puts every Sunday 1pm ET kickoff of the season at 17:00Z or 18:00Z", () => {
    const sundays = [
      "20260913", "20260920", "20260927", "20261004", "20261011", "20261018", "20261025",
      "20261101", "20261108", "20261115", "20261122", "20261129", "20261206", "20261213", "20261220", "20261227",
    ];
    for (const date of sundays) {
      const expected = date < "20261101" ? "17:00:00.000Z" : "18:00:00.000Z";
      expect(iso(date, "1:00p"), date).toBe(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${expected}`);
    }
  });
});

describe("hasEasternKickoffPassed", () => {
  it("does not lock a 1pm EST game at noon Eastern", () => {
    const noonET = Date.parse("2026-11-01T17:00:00Z"); // 12:00 EST
    expect(hasEasternKickoffPassed("20261101", "1:00p", noonET)).toBe(false);
    expect(hasEasternKickoffPassed("20261101", "1:00p", noonET + 3_600_000)).toBe(true);
  });
  it("is false when the time can't be read", () => {
    expect(hasEasternKickoffPassed("20261101", "TBD", Date.now())).toBe(false);
  });
});
