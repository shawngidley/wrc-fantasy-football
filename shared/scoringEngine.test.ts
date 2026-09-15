import { describe, expect, it } from "vitest";
import { calcFantasyPoints, sacksFrom, n } from "./scoringEngine";

describe("calcFantasyPoints (shared)", () => {
  // These specific cases are the exact discrepancies confirmed live
  // between the old, separate server-side formula and the client's
  // live-scoring formula -- now that both paths import this single,
  // shared function, these behaviors apply identically everywhere.

  it("credits a non-DST player's return touchdown -- previously missing entirely from the server-side formula", () => {
    const points = calcFantasyPoints({
      Receiving: { receptions: 2, recYds: 20, recTD: 0 },
      Defense: { returnTD: 1 },
    }, "WR");
    // 2 rec * 1.0 + 20 yds * 0.1 + 1 return TD * 6 = 2 + 2 + 6 = 10
    expect(points).toBe(10);
  });

  it("checks stats.Fumbles.fumblesLost as well as stats.Defense.fumblesLost -- the server-side formula previously only checked the latter", () => {
    const points = calcFantasyPoints({
      Rushing: { rushYds: 50, rushTD: 0 },
      Fumbles: { fumblesLost: 1 },
    }, "RB");
    // 50 yds * 0.1 - 1 fumble * 3 = 5 - 3 = 2
    expect(points).toBe(2);
  });

  it("prefers the combined defensiveOrSpecialTeamsTds field over summing defTD+returnTD separately for DST", () => {
    const points = calcFantasyPoints({
      Defense: { defensiveOrSpecialTeamsTds: 1, defTD: 1, returnTD: 1 },
    }, "DST");
    // Should count the combined field (1 TD = 6 pts), not defTD+returnTD (which would double-count to 2 TDs = 12 pts)
    expect(points).toBe(6);
  });

  it("falls back to summing defTD + returnTD when defensiveOrSpecialTeamsTds is absent", () => {
    const points = calcFantasyPoints({
      Defense: { defTD: 1, returnTD: 1 },
    }, "DST");
    expect(points).toBe(12);
  });

  it("gates the offensive fumbles-lost penalty to 0 for DST -- a DST's own fumble credit comes entirely from fumblesRecovered", () => {
    const points = calcFantasyPoints({
      Defense: { fumblesRecovered: 1, fumblesLost: 5 },
    }, "DST");
    // Only the +3 for fumblesRecovered should apply; the -3 fumblesLost
    // penalty (which doesn't represent the DST's own negative event)
    // must not apply at all for DST.
    expect(points).toBe(3);
  });

  it("applies the 1.5x TE reception bonus", () => {
    const points = calcFantasyPoints({
      Receiving: { receptions: 4, recYds: 0, recTD: 0 },
    }, "TE");
    expect(points).toBe(6); // 4 * 1.5
  });
});

describe("sacksFrom (shared)", () => {
  it("parses sacks from the combined sacksAndYardsLost string when no plain sacks field exists", () => {
    expect(sacksFrom({ sacksAndYardsLost: "3-10" })).toBe(3);
  });

  it("prefers a plain sacks field when present", () => {
    expect(sacksFrom({ sacks: 4, sacksAndYardsLost: "3-10" })).toBe(4);
  });

  it("returns 0 when neither field is present", () => {
    expect(sacksFrom({})).toBe(0);
  });
});

describe("n (shared)", () => {
  it("parses numeric strings", () => {
    expect(n("12.5")).toBe(12.5);
  });

  it("passes through actual numbers", () => {
    expect(n(7)).toBe(7);
  });

  it("returns 0 for undefined, null, or non-numeric input", () => {
    expect(n(undefined)).toBe(0);
    expect(n("not a number")).toBe(0);
  });
});
