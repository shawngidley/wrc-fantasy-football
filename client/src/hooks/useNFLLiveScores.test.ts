import { describe, expect, it } from "vitest";
import { attributeDefensiveSacks } from "./useNFLLiveScores";

describe("attributeDefensiveSacks", () => {
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
    const result = attributeDefensiveSacks("away", teamStats.away, teamStats);
    expect(result.sacksAndYardsLost).toBe("2-12"); // SEA's value, not NE's own "3-10"
  });

  it("attributes the OPPONENT's sacksAndYardsLost to this team's defense (home entry)", () => {
    const result = attributeDefensiveSacks("home", teamStats.home, teamStats);
    expect(result.sacksAndYardsLost).toBe("3-10"); // NE's value, not SEA's own "2-12"
  });

  it("preserves all other fields from the team's own stats, only overriding sack fields", () => {
    const result = attributeDefensiveSacks("away", teamStats.away, teamStats);
    expect(result.team).toBe("NE"); // unchanged, still this team's own field
  });

  it("falls back to no sacks (undefined) rather than the team's own wrong value if the opponent entry is missing", () => {
    const incompleteTeamStats = { away: teamStats.away }; // no "home" entry at all
    const result = attributeDefensiveSacks("away", teamStats.away, incompleteTeamStats);
    expect(result.sacksAndYardsLost).toBeUndefined();
  });
});
