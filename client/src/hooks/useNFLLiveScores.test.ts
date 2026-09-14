import { describe, expect, it } from "vitest";
import { attributeOffenseFramedDefenseStats, getLivePoints, getLiveStats } from "./useNFLLiveScores";

describe("attributeOffenseFramedDefenseStats", () => {
  // Real, confirmed data from the actual box score (NE @ SEA, Sept 9 2026):
  // New England's defense genuinely had 2 sacks, Seattle's had 3 -- but
  // Tank01's own teamStats entries show the OPPOSITE numbers under each
  // team's own key, since sacksAndYardsLost tracks that team's OFFENSE
  // being sacked, not their defense's sacks.
  const teamStats = {
    away: { sacksAndYardsLost: "3-10", team: "NE" }, // NE's OFFENSE was sacked 3 times (by SEA's defense)
    home: { sacksAndYardsLost: "2-12", team: "SEA" }, // SEA's OFFENSE was sacked 2 times (by NE's defense)
  };

  it("attributes the OPPONENT's sacksAndYardsLost to this team's defense (away entry)", () => {
    const result = attributeOffenseFramedDefenseStats("away", teamStats.away, teamStats);
    expect(result.sacksAndYardsLost).toBe("2-12"); // SEA's value, not NE's own "3-10"
  });

  it("attributes the OPPONENT's sacksAndYardsLost to this team's defense (home entry)", () => {
    const result = attributeOffenseFramedDefenseStats("home", teamStats.home, teamStats);
    expect(result.sacksAndYardsLost).toBe("3-10"); // NE's value, not SEA's own "2-12"
  });

  it("preserves all other fields from the team's own stats, only overriding sack fields", () => {
    const result = attributeOffenseFramedDefenseStats("away", teamStats.away, teamStats);
    expect(result.team).toBe("NE"); // unchanged, still this team's own field
  });

  it("falls back to no sacks (undefined) rather than the team's own wrong value if the opponent entry is missing", () => {
    const incompleteTeamStats = { away: teamStats.away }; // no "home" entry at all
    const result = attributeOffenseFramedDefenseStats("away", teamStats.away, incompleteTeamStats);
    expect(result.sacksAndYardsLost).toBeUndefined();
  });

  describe("fumble recovery attribution", () => {
    // Real, confirmed data from the actual live game (NO @ DET): Detroit's
    // DST had no fumblesRecovered field at all, only fumblesLost: "1"
    // under Detroit's own entry -- representing Detroit's own offense
    // losing a fumble. The box score confirmed New Orleans recovered one
    // of their own two fumbles and lost the other to Detroit's defense,
    // so Detroit's defensive credit needed to come from New Orleans's
    // fumblesLost value instead.
    const fumbleTeamStats = {
      home: { fumblesLost: "1", team: "DET" }, // DET's own OFFENSE lost 1 fumble
      away: { fumblesLost: "1", team: "NO" },  // NO's own OFFENSE lost 1 fumble (recovered by DET's defense)
    };

    it("attributes the OPPONENT's fumblesLost as this team's fumblesRecovered", () => {
      const result = attributeOffenseFramedDefenseStats("home", fumbleTeamStats.home, fumbleTeamStats);
      expect(result.fumblesRecovered).toBe("1"); // NO's fumblesLost, credited to DET's defense
    });

    it("does not use this team's own fumblesLost as its own fumblesRecovered", () => {
      const result = attributeOffenseFramedDefenseStats("home", fumbleTeamStats.home, fumbleTeamStats);
      // DET's own fumblesLost ("1") should not appear as DET's own stat
      // under its original meaning -- it's been replaced entirely.
      expect(result.fumblesLost).toBeUndefined();
    });

    it("leaves fumblesRecovered undefined when the opponent has no fumblesLost value", () => {
      const noFumbleStats = { home: { team: "DET" }, away: { team: "NO" } };
      const result = attributeOffenseFramedDefenseStats("home", noFumbleStats.home, noFumbleStats);
      expect(result.fumblesRecovered).toBeUndefined();
    });
  });
});

describe("getLivePoints TE reception bonus (Tank01 empty-position bug)", () => {
  // Confirmed live: Tank01's own position field is empty ("") for
  // player-level box score stats, for every player -- not just TEs.
  // The pre-computed liveScores value was calculated with this empty
  // pos, so calcFantasyPoints' teReception check ("TE" === "") always
  // failed regardless of the player's real position, silently dropping
  // WRC's 1.5/reception TE bonus for every TE, every time.
  it("correctly applies the TE reception bonus by re-computing from raw stats with the caller's correct position (T. McBride: 9 rec, 95 yds, 1 TD)", () => {
    const liveStats = { "treymcbride": { Receiving: { receptions: 9, recYds: 95, recTD: 1 } } };
    const liveScores = { "treymcbride": 24.5 }; // the old, TE-blind pre-computed value (bug)
    const points = getLivePoints(liveScores, "Trey McBride", "TE", "ARI", [], liveStats);
    // 9*1.5 + 95*0.1 + 1*6 = 13.5 + 9.5 + 6.0 = 29.0
    expect(points).toBe(29.0);
  });

  it("correctly applies the TE reception bonus (D. Goedert: 4 rec, 77 yds, 2 TD)", () => {
    const liveStats = { "dallasgoedert": { Receiving: { receptions: 4, recYds: 77, recTD: 2 } } };
    const liveScores = { "dallasgoedert": 23.7 }; // the old, TE-blind pre-computed value (bug)
    const points = getLivePoints(liveScores, "Dallas Goedert", "TE", "PHI", [], liveStats);
    // 4*1.5 + 77*0.1 + 2*6 = 6.0 + 7.7 + 12.0 = 25.7
    expect(points).toBe(25.7);
  });

  it("does not change a non-TE player's score, since teReception is false either way", () => {
    const liveStats = { "amonrastbrown": { Receiving: { receptions: 8, recYds: 68 } } };
    const liveScores = { "amonrastbrown": 14.8 };
    const points = getLivePoints(liveScores, "Amon-Ra St. Brown", "WR", "DET", [], liveStats);
    // 8*1.0 + 68*0.1 = 8.0 + 6.8 = 14.8 -- same result whether TE-aware or not
    expect(points).toBe(14.8);
  });

  it("falls back to the pre-computed liveScores value when no raw stats are available for this player", () => {
    const points = getLivePoints({ "treymcbride": 24.5 }, "Trey McBride", "TE", "ARI", [], {});
    expect(points).toBe(24.5);
  });
});

describe("getLivePoints suffix mismatch (James Cook bug)", () => {
  // Confirmed live: Tank01 returns "James Cook III" (with the
  // generational suffix), but WRC's roster stores him as "James Cook"
  // (no suffix) -- a naive .toLowerCase() key match never found him,
  // even though his score was correctly computed and stored under the
  // Tank01 name's key. normalizePlayerName("James Cook") -> "jamescook"
  // (no space -- it strips all non-alphanumeric characters).
  it("finds a player's score when the roster name lacks a suffix Tank01's name includes", () => {
    const liveScores = { "jamescook": 14.2 }; // stored under the normalized (suffix-stripped) key
    const points = getLivePoints(liveScores, "James Cook", "RB", "BUF");
    expect(points).toBe(14.2);
  });

  it("finds a player's score when the roster name includes a suffix and the stored key is also normalized", () => {
    const liveScores = { "jamescook": 14.2 };
    // Even if the roster happened to store the suffix too, both sides
    // normalize to the same key.
    const points = getLivePoints(liveScores, "James Cook III", "RB", "BUF");
    expect(points).toBe(14.2);
  });

  it("returns null (not 0) when the player genuinely isn't found", () => {
    const points = getLivePoints({}, "James Cook", "RB", "BUF");
    expect(points).toBeNull();
  });
});

describe("getLiveStats suffix mismatch", () => {
  it("finds a player's raw stats despite a suffix mismatch between the two sides", () => {
    const liveStats = { "jamescook": { Rushing: { rushYds: 87, rushTD: 1, carries: 18 } } };
    const stats = getLiveStats(liveStats, "James Cook", "RB", "BUF");
    expect(stats?.Rushing?.rushYds).toBe(87);
  });
});
