import { describe, expect, it } from "vitest";
import { calcFantasyPoints } from "./scoringEngine";
import { DST_SEASON_STATS_2025 } from "./dstSeasonStats2025";

describe("calcFantasyPoints", () => {
  it("applies the published WRC QB, rushing, receiving, and lost-fumble rules", () => {
    const points = calcFantasyPoints({
      Passing: { passYds: 250, passTD: 2, int: 1, passingTwoPointConversion: 1 },
      Rushing: { rushYds: 20, rushTD: 1, rushingTwoPointConversion: 1 },
      Receiving: { receptions: 3, recYds: 30, recTD: 1, receivingTwoPointConversion: 1 },
      Fumbles: { fumblesLost: 1 },
    }, "RB");
    expect(points).toBe(37);
  });

  it("uses TE premium, return touchdowns, and a single lost-fumble value", () => {
    const points = calcFantasyPoints({
      Receiving: { receptions: 4, recYds: 50, recTD: 1 },
      Defense: { fumblesLost: 1, returnTD: 1 },
      Fumbles: { fumblesLost: 1 },
    }, "TE");
    expect(points).toBe(20);
  });

  it("counts a combined D/ST touchdown total once and excludes D/ST fumble-loss penalties", () => {
    const points = calcFantasyPoints({
      Defense: { sacks: 2, defensiveInterceptions: 1, fumblesRecovered: 1, defTD: 1, returnTD: 1, defensiveOrSpecialTeamsTds: 2, safeties: 1, fumblesLost: 9 },
    }, "DST");
    expect(points).toBe(24);
  });

  it("reconciles Cleveland and the Chargers D/ST FPTS and FP/G from completed 2025 totals", () => {
    const score = (team: "CLE" | "LAC") => {
      const line = DST_SEASON_STATS_2025[team];
      return calcFantasyPoints({ Defense: {
        sacks: line.sacks,
        defensiveInterceptions: line.defInt,
        fumblesRecovered: line.fumblesRecovered,
        defensiveOrSpecialTeamsTds: line.dstTD,
        safeties: line.safeties,
      } }, "DST");
    };

    expect(score("CLE")).toBe(184);
    expect(score("CLE") / DST_SEASON_STATS_2025.CLE.games).toBeCloseTo(10.8, 1);
    expect(score("LAC")).toBe(161);
    expect(score("LAC") / DST_SEASON_STATS_2025.LAC.games).toBeCloseTo(9.5, 1);
  });
});
