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
      takeaways: 20,
      defTD: 3,
      dstTD: 3,
      ptsAgainst: 424,
      wrcPts: 154,
      ptsPerGame: 9.1,
    });
  });

  it("uses a completed 17-game season when preseason standings have reset but team totals remain", () => {
    const stats = normalizeTankTeamSeasonStats({
      teamAbv: "NYG",
      wins: "0",
      loss: "0",
      tie: "0",
      teamStats: { Defense: { sacks: "34", defensiveInterceptions: "8", fumblesRecovered: "7", defTD: "2" } },
    });

    expect(stats).toMatchObject({ gp: 17, wrcPts: 125, ptsPerGame: 7.4 });
  });
});
