import { describe, expect, it } from "vitest";
import { isOwnerCutWindowOpen } from "./ownerCut";

// Nov 2026 is EST (UTC-5). Sun Nov 22, Mon 23, Tue 24, Thu 26.
const est = (iso: string) => new Date(`${iso}-05:00`);
// Sept 2026 is EDT (UTC-4). Sun Sep 20, Mon 21, Tue 22.
const edt = (iso: string) => new Date(`${iso}-04:00`);

describe("isOwnerCutWindowOpen", () => {
  it("is open Tuesday 9am through Sunday 12:59pm ET", () => {
    expect(isOwnerCutWindowOpen(est("2026-11-24T09:00:00"))).toBe(true);
    expect(isOwnerCutWindowOpen(est("2026-11-26T10:00:00"))).toBe(true);
    expect(isOwnerCutWindowOpen(est("2026-11-22T12:59:00"))).toBe(true);
  });

  it("closes at 1:00 PM ET Sunday", () => {
    expect(isOwnerCutWindowOpen(est("2026-11-22T13:00:00"))).toBe(false);
    expect(isOwnerCutWindowOpen(est("2026-11-22T20:30:00"))).toBe(false);
  });

  it("stays closed all Monday and until Tuesday 9am", () => {
    expect(isOwnerCutWindowOpen(est("2026-11-23T12:00:00"))).toBe(false);
    expect(isOwnerCutWindowOpen(est("2026-11-24T08:59:00"))).toBe(false);
  });

  // Most of the season is EDT, and this repo has had a bug from assuming one
  // Eastern offset all year (kickoff times, fixed in 9a5bef0). The boundaries
  // must land at 1pm and 9am LOCAL in both halves of the season, so the same
  // four edges are checked in September.
  it("puts the boundaries at the same local times during EDT", () => {
    expect(isOwnerCutWindowOpen(edt("2026-09-20T12:59:00"))).toBe(true);  // Sun before 1pm
    expect(isOwnerCutWindowOpen(edt("2026-09-20T13:00:00"))).toBe(false); // Sun 1pm
    expect(isOwnerCutWindowOpen(edt("2026-09-22T08:59:00"))).toBe(false); // Tue before 9am
    expect(isOwnerCutWindowOpen(edt("2026-09-22T09:00:00"))).toBe(true);  // Tue 9am
  });

  // Midnight is the one hour an hour12:false formatter can report as either 0
  // or 24; Sunday 00:00 has to read as open, not as past 1pm.
  it("treats Sunday midnight as open", () => {
    expect(isOwnerCutWindowOpen(est("2026-11-22T00:00:00"))).toBe(true);
    expect(isOwnerCutWindowOpen(edt("2026-09-20T00:00:00"))).toBe(true);
  });
});
