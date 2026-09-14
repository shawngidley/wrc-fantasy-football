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
