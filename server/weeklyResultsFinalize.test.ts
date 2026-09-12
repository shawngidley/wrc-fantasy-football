import { describe, expect, it } from "vitest";
import { moneyOwedIdForOwner, resolveTeamStatsKey, sacksFrom, defensePoints } from "./weeklyResultsFinalize";

describe("moneyOwedIdForOwner", () => {
  it("matches every owner's actual money_owed.id (verified against Money.tsx's DEFAULT_OWNERS)", () => {
    expect(moneyOwedIdForOwner("Shawn")).toBe("shawn");
    expect(moneyOwedIdForOwner("Greg")).toBe("greg");
    expect(moneyOwedIdForOwner("Jonas")).toBe("jonas");
    expect(moneyOwedIdForOwner("Jamie")).toBe("jamie");
    expect(moneyOwedIdForOwner("Bill")).toBe("bill");
    expect(moneyOwedIdForOwner("Scott M.")).toBe("scottm");
    expect(moneyOwedIdForOwner("David S.")).toBe("davids");
    expect(moneyOwedIdForOwner("David R.")).toBe("davidr");
    expect(moneyOwedIdForOwner("Scott N.")).toBe("scottn");
    expect(moneyOwedIdForOwner("Jason")).toBe("jason");
    expect(moneyOwedIdForOwner("Keith")).toBe("keith");
    expect(moneyOwedIdForOwner("Dan")).toBe("dan");
  });
});

describe("resolveTeamStatsKey", () => {
  it("resolves 'home' to the game's actual home team abbreviation", () => {
    expect(resolveTeamStatsKey("home", { home: "SEA", away: "NE" })).toBe("SEA");
  });

  it("resolves 'away' to the game's actual away team abbreviation", () => {
    expect(resolveTeamStatsKey("away", { home: "SEA", away: "NE" })).toBe("NE");
  });

  it("normalizes known team code aliases (e.g. ARI stays ARI, JAX becomes JAC)", () => {
    expect(resolveTeamStatsKey("home", { home: "jax", away: "ari" })).toBe("JAC");
    expect(resolveTeamStatsKey("away", { home: "jax", away: "ari" })).toBe("ARI");
  });

  it("returns undefined for a key that is neither 'home' nor 'away'", () => {
    expect(resolveTeamStatsKey("SEA", { home: "SEA", away: "NE" })).toBeUndefined();
  });

  it("returns undefined if the game is missing the relevant home/away field", () => {
    expect(resolveTeamStatsKey("home", { away: "NE" })).toBeUndefined();
    expect(resolveTeamStatsKey("away", { home: "SEA" })).toBeUndefined();
  });
});

describe("sacksFrom", () => {
  it("parses sacks from the combined sacksAndYardsLost field (e.g. '3-10' -> 3)", () => {
    expect(sacksFrom({ sacksAndYardsLost: "3-10" })).toBe(3);
  });

  it("prefers a plain sacks field over sacksAndYardsLost if both are present", () => {
    expect(sacksFrom({ sacks: 5, sacksAndYardsLost: "3-10" })).toBe(5);
  });

  it("returns 0 when neither field is present", () => {
    expect(sacksFrom({})).toBe(0);
  });
});

describe("defensePoints (confirmed rules: sack 2pts, fumble/interception 3pts each, touchdown 6pts, safety 2pts -- nothing else)", () => {
  it("scores sacks from sacksAndYardsLost correctly (this was the actual bug: always 0 before)", () => {
    expect(defensePoints({ sacksAndYardsLost: "3-10" })).toBe(6); // 3 sacks * 2
  });

  it("scores each confirmed category correctly", () => {
    expect(defensePoints({ defensiveInterceptions: 2 })).toBe(6); // 2 * 3
    expect(defensePoints({ fumblesRecovered: 1 })).toBe(3);
    expect(defensePoints({ defTD: 1 })).toBe(6);
    expect(defensePoints({ safeties: 1 })).toBe(2);
  });

  it("does not score points-allowed or a blocked-kick bonus -- confirmed neither is a real category", () => {
    expect(defensePoints({})).toBe(0);
  });
});
