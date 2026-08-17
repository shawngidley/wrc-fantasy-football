import { describe, expect, it } from "vitest";
import { normalizeCompletedDstSeasonStats, normalizeTankTeamSeasonStats } from "./playerSeasonStats";
import { DST_SEASON_STATS_2025 } from "./dstSeasonStats2025";

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

describe("normalizeCompletedDstSeasonStats", () => {
  it("uses reconciled 2025 totals for all 32 teams instead of Tank01's ambiguous recovery field", () => {
    expect(Object.keys(DST_SEASON_STATS_2025)).toHaveLength(32);

    const tampaBay = normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.TB);
    const greenBay = normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.GB);

    expect(tampaBay).toMatchObject({ sacks: 37, safeties: 1, takeaways: 23, fumblesRecovered: 10, dstTD: 2, ptsAgainst: 411 });
    expect(greenBay).toMatchObject({ sacks: 36, safeties: 0, takeaways: 14, fumblesRecovered: 7, dstTD: 0, ptsAgainst: 360 });
    expect(tampaBay.takeaways).toBe(tampaBay.defInt + tampaBay.fumblesRecovered);
    expect(greenBay.takeaways).toBe(greenBay.defInt + greenBay.fumblesRecovered);
  });

  it("preserves the complete league-wide 2025 reconciliation", () => {
    const totals = Object.values(DST_SEASON_STATS_2025).reduce((accumulator, team) => ({
      sacks: accumulator.sacks + team.sacks,
      safeties: accumulator.safeties + team.safeties,
      takeaways: accumulator.takeaways + team.takeaways,
      dstTD: accumulator.dstTD + team.dstTD,
    }), { sacks: 0, safeties: 0, takeaways: 0, dstTD: 0 });

    expect(totals).toEqual({ sacks: 1287, safeties: 12, takeaways: 629, dstTD: 67 });
    expect(Object.values(DST_SEASON_STATS_2025).every(team => team.games === 17 && team.takeaways === team.defInt + team.fumblesRecovered)).toBe(true);
  });
});
