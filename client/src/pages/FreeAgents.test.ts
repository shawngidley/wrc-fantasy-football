import { describe, expect, it } from "vitest";
import type { PlayerSeasonStats } from "@/lib/playerSeasonStats";
import { freeAgentStatValue, getFreeAgentStatColumns, getFreeAgentTableColumns } from "./FreeAgents";

const stats: PlayerSeasonStats = {
  gp: 17, passCmp: 0, passAtt: 0, passYds: 0, passTD: 4, passInt: 6, passRating: 0,
  rushAtt: 0, rushYds: 0, rushTD: 0, receptions: 0, targets: 0, recYds: 0, recTD: 0,
  fgMade: 32, fgAtt: 38, fgYds: 0, fgMade1To39: 0, fgMade40To49: 0, fgMade50To59: 0, fgMade60Plus: 0,
  xpMade: 32, xpAtt: 33, sacks: 37, defInt: 13, fumblesRecovered: 10, takeaways: 23,
  defTD: 2, dstTD: 2, returnTD: 0, safeties: 1, blockKicks: 0, ptsAgainst: 0,
  fumblesLost: 2, wrcPts: 156.6, ptsPerGame: 9.2,
};

describe("Free Agents Lineup stat alignment", () => {
  it("uses final GP and the requested scoring-stat sequence for SFLEX, K, and D/ST", () => {
    expect(getFreeAgentStatColumns("SFLEX").map(column => column.label)).toEqual([
      "FPTS", "FP/G", "YDS", "TD", "INT", "ATT", "YDS", "TD", "TGT", "REC", "YDS", "TD", "TO", "GP",
    ]);
    expect(getFreeAgentStatColumns("K").map(column => column.label)).toEqual([
      "FPTS", "FP/G", "FGM", "FGA", "FG%", "XPM", "XPA", "XP%", "GP",
    ]);
    expect(getFreeAgentStatColumns("DST").map(column => column.label)).toEqual([
      "FPTS", "FP/G", "SK", "SFT", "TA", "TDDST", "GP",
    ]);
  });

  it("derives Free Agents turnover and percentage cells from the shared season stat shape", () => {
    expect(freeAgentStatValue(stats, "turnovers")).toBe(8);
    expect(freeAgentStatValue(stats, "fgPct")).toBeCloseTo(84.21, 2);
    expect(freeAgentStatValue(stats, "xpPct")).toBeCloseTo(96.97, 2);
  });

  it("uses complete Lineup-equivalent fields with WRC Team as the one additional status column", () => {
    expect(getFreeAgentTableColumns("SFLEX").map(column => column.label)).toEqual([
      "Player", "WRC Team", "Age", "Bye", "Opp", "Game", "FPTS", "FP/G", "Proj",
      "YDS", "TD", "INT", "ATT", "YDS", "TD", "TGT", "REC", "YDS", "TD", "TO", "GP", "Action", "",
    ]);
    expect(getFreeAgentTableColumns("K").map(column => column.label)).toEqual([
      "Player", "WRC Team", "Age", "Bye", "Opp", "Game", "FPTS", "FP/G", "Proj",
      "FGM", "FGA", "FG%", "XPM", "XPA", "XP%", "GP", "Action", "",
    ]);
    expect(getFreeAgentTableColumns("DST").map(column => column.label)).toEqual([
      "Player", "WRC Team", "Age", "Bye", "Opp", "Game", "FPTS", "FP/G", "Proj",
      "SK", "SFT", "TA", "TDDST", "GP", "Action", "",
    ]);
  });

  it("retains the complete table header schema while the player rows are loading", () => {
    expect(getFreeAgentTableColumns("SFLEX").slice(0, 9).map(column => column.label)).toEqual([
      "Player", "WRC Team", "Age", "Bye", "Opp", "Game", "FPTS", "FP/G", "Proj",
    ]);
  });
});
