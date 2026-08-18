import { describe, expect, it } from "vitest";
import { normalizeCompletedDstSeasonStats, normalizeCompletedKickerSeasonStats, normalizeTankTeamSeasonStats } from "./playerSeasonStats";
import { DST_SEASON_STATS_2025 } from "./dstSeasonStats2025";
import { getCompletedKickerSeasonStats } from "./kickerSeasonStats2025";

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

describe("normalizeCompletedKickerSeasonStats", () => {
  it("uses exact made- and missed-kick scoring rather than Tank01's unavailable FG yard aggregate", () => {
    const aubrey = normalizeCompletedKickerSeasonStats(getCompletedKickerSeasonStats("Brandon Aubrey")!);
    const borregales = normalizeCompletedKickerSeasonStats(getCompletedKickerSeasonStats("Andres Borregales")!);
    const butker = normalizeCompletedKickerSeasonStats(getCompletedKickerSeasonStats("Harrison Butker")!);
    const lutz = normalizeCompletedKickerSeasonStats(getCompletedKickerSeasonStats("Wil Lutz")!);
    const tucker = normalizeCompletedKickerSeasonStats(getCompletedKickerSeasonStats("Justin Tucker")!);

    expect(aubrey).toMatchObject({ gp: 17, fgMade: 36, fgAtt: 42, xpMade: 47, xpAtt: 48, wrcPts: 195.4, ptsPerGame: 11.5 });
    expect(borregales).toMatchObject({ gp: 17, fgMade: 27, fgAtt: 32, xpMade: 53, xpAtt: 55, wrcPts: 135.8 });
    expect(butker).toMatchObject({ gp: 17, fgMade: 33, fgAtt: 38, xpMade: 31, xpAtt: 35, wrcPts: 143.3, ptsPerGame: 8.4 });
    expect(lutz).toMatchObject({ gp: 17, fgMade: 28, fgAtt: 32, xpMade: 39, xpAtt: 39, wrcPts: 132.7, ptsPerGame: 7.8 });
    expect(tucker).toMatchObject({ gp: 0, fgMade: 0, fgAtt: 0, xpMade: 0, xpAtt: 0, wrcPts: 0, ptsPerGame: 0 });
  });
});
