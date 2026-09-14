import { describe, expect, it } from "vitest";
import { moneyOwedIdForOwner, resolveTeamStatsKey, sacksFrom, defensePoints, attributeOffenseFramedDefenseStats, playerPoints } from "./weeklyResultsFinalize";

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

describe("attributeOffenseFramedDefenseStats", () => {
  // Real, confirmed data from the actual box score (NE @ SEA, Sept 9 2026):
  // New England's defense genuinely had 2 sacks, Seattle's had 3 -- but
  // Tank01's own teamStats entries show the OPPOSITE numbers under each
  // team's own key, since sacksAndYardsLost tracks that team's OFFENSE
  // being sacked, not their defense's sacks.
  const teamStatsBody = {
    away: { sacksAndYardsLost: "3-10", team: "NE" }, // NE's OFFENSE was sacked 3 times (by SEA's defense)
    home: { sacksAndYardsLost: "2-12", team: "SEA" }, // SEA's OFFENSE was sacked 2 times (by NE's defense)
  };

  it("attributes the OPPONENT's sacksAndYardsLost to this team's defense (away entry)", () => {
    const result = attributeOffenseFramedDefenseStats("away", teamStatsBody.away, teamStatsBody);
    // NE's defense credit should be SEA's "2-12" (2 sacks), not NE's own "3-10"
    expect(sacksFrom(result)).toBe(2);
  });

  it("attributes the OPPONENT's sacksAndYardsLost to this team's defense (home entry)", () => {
    const result = attributeOffenseFramedDefenseStats("home", teamStatsBody.home, teamStatsBody);
    // SEA's defense credit should be NE's "3-10" (3 sacks), not SEA's own "2-12"
    expect(sacksFrom(result)).toBe(3);
  });

  it("preserves all other fields from the team's own stats, only overriding sack fields", () => {
    const result = attributeOffenseFramedDefenseStats("away", teamStatsBody.away, teamStatsBody);
    expect(result.team).toBe("NE"); // unchanged, still this team's own field
  });

  it("full pipeline: defensePoints on the attributed stats gives the correct, confirmed sack total", () => {
    const neDefenseStats = attributeOffenseFramedDefenseStats("away", { defensiveInterceptions: 0, safeties: 0 }, teamStatsBody);
    expect(defensePoints(neDefenseStats)).toBe(4); // 2 sacks * 2 = 4, matching the real box score
  });
});

describe("attributeOffenseFramedDefenseStats -- fumble recovery", () => {
  // Real, confirmed data from the actual live game (NO @ DET): Detroit's
  // DST had no fumblesRecovered field at all, only fumblesLost: "1"
  // under Detroit's own entry -- representing Detroit's own offense
  // losing a fumble. The box score confirmed New Orleans recovered one
  // of their own two fumbles and lost the other to Detroit's defense.
  const fumbleTeamStatsBody = {
    home: { fumblesLost: "1", team: "DET" },
    away: { fumblesLost: "1", team: "NO" },
  };

  it("attributes the OPPONENT's fumblesLost as this team's fumblesRecovered", () => {
    const result = attributeOffenseFramedDefenseStats("home", fumbleTeamStatsBody.home, fumbleTeamStatsBody);
    expect(result.fumblesRecovered).toBe("1");
  });

  it("full pipeline: defensePoints correctly credits Detroit's confirmed scenario (SACK 5, INT 2, FR 1 = 19)", () => {
    const detTeamStatsBody = {
      // NO's own entry: NO's offense was sacked 5 times and lost 1
      // fumble -- both of which are exactly what DET's defense should
      // be credited for.
      home: { sacksAndYardsLost: "5-32", fumblesLost: "1", team: "NO" },
      away: { team: "DET" }, // DET's own raw entry, unused for these two fields
    };
    const detAttributed = attributeOffenseFramedDefenseStats("away", detTeamStatsBody.away, detTeamStatsBody);
    const detStats = { ...detAttributed, defensiveInterceptions: 2 };
    expect(defensePoints(detStats)).toBe(19); // 5*2 + 2*3 + 1*3 = 19
  });
});

describe("playerPoints TE reception bonus", () => {
  // Confirmed live: Tank01's own position field is empty ("") for
  // player-level box score stats. finalizeWeeklyResultsFromTank was
  // calling playerPoints(entry, entry.pos) directly, so this always
  // failed the TE-reception check regardless of the player's real
  // position -- silently dropping WRC's 1.5/reception TE bonus from
  // every TE's official, recorded weekly score. Fixed by looking up
  // each player's real position from the already-fetched roster data
  // instead of trusting Tank01's empty field.
  it("applies the 1.5/reception bonus when given the correct position (T. McBride: 9 rec, 95 yds, 1 TD)", () => {
    const pts = playerPoints({ Receiving: { receptions: 9, recYds: 95, recTD: 1 } }, "TE");
    expect(pts).toBe(29.0); // 9*1.5 + 95*0.1 + 1*6
  });

  it("applies the 1.5/reception bonus (D. Goedert: 4 rec, 77 yds, 2 TD)", () => {
    const pts = playerPoints({ Receiving: { receptions: 4, recYds: 77, recTD: 2 } }, "TE");
    expect(pts).toBe(25.7); // 4*1.5 + 77*0.1 + 2*6
  });

  it("does NOT apply the TE bonus when given Tank01's own empty position string -- demonstrates the exact bug being fixed", () => {
    const pts = playerPoints({ Receiving: { receptions: 9, recYds: 95, recTD: 1 } }, "");
    expect(pts).toBe(24.5); // 9*1.0 + 9.5 + 6.0 -- the old, buggy result
  });

  it("does not apply any reception bonus for a non-TE position", () => {
    const pts = playerPoints({ Receiving: { receptions: 8, recYds: 68 } }, "WR");
    expect(pts).toBe(14.8); // 8*1.0 + 6.8
  });
});
