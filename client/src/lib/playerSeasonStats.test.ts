import { describe, expect, it } from "vitest";
import { normalizeTankTeamSeasonStats } from "./playerSeasonStats";

describe("normalizeTankTeamSeasonStats", () => {
  it("maps Tank01 team-defense totals into the D/ST Lineup stat row", () => {
    const stats = normalizeTankTeamSeasonStats({
      teamAbv: "NYG",
      wins: "3",
      loss: "14",
      pa: "424",
      teamStats: {
        Defense: {
          sacks: "38",
          defensiveInterceptions: "9",
          fumblesRecovered: "11",
          defTD: "3",
        },
      },
    });

    expect(stats).toMatchObject({
      gp: 17,
      sacks: 38,
      defInt: 9,
      fumblesRecovered: 11,
      defTD: 3,
      ptsAgainst: 424,
      wrcPts: 154,
      ptsPerGame: 9.1,
    });
  });
});
