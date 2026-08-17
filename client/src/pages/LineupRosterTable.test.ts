import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineupRosterTable } from "./Lineup";
import type { PlayerSeasonStats } from "@/lib/playerSeasonStats";

const dstStats: PlayerSeasonStats = {
  gp: 17, passCmp: 0, passAtt: 0, passYds: 0, passTD: 0, passInt: 0, passRating: 0,
  rushAtt: 0, rushYds: 0, rushTD: 0, receptions: 0, targets: 0, recYds: 0, recTD: 0,
  fgMade: 0, fgAtt: 0, fgYds: 0, fgMade1To39: 0, fgMade40To49: 0, fgMade50To59: 0, fgMade60Plus: 0,
  xpMade: 0, xpAtt: 0, sacks: 38, defInt: 9, fumblesRecovered: 11, takeaways: 20,
  defTD: 3, dstTD: 3, returnTD: 0, safeties: 0, blockKicks: 0, ptsAgainst: 0,
  fumblesLost: 0, wrcPts: 154, ptsPerGame: 9.1,
};

const starter = { id: "nyg", name: "New York Giants", nflTeam: "NYG", pos: "DST", pts: 0, proj: 8.3, status: "Active", slot: "DST", byeWeek: 8 };
const candidate = { id: "car", name: "Carolina Panthers", nflTeam: "CAR", pos: "DST", pts: 0, proj: 7.5, status: "Active", isBench: true, byeWeek: 5 };

describe("LineupRosterTable D/ST candidate rows", () => {
  it("uses the requested SK, SFT, TA, and TDDST mapping in both standard and expanded candidate rows", () => {
    const html = renderToStaticMarkup(createElement(LineupRosterTable, {
      title: "D/ST · 2 players",
      profile: "DST",
      players: [starter],
      statMap: { "new york giants": dstStats, "carolina panthers": dstStats },
      metaMap: {},
      matchupMap: {} as never,
      injuries: [],
      selectedId: "newyorkgiants",
      isReadOnly: false,
      onSelect: () => undefined,
      onPlayerClick: () => undefined,
      getInlineChoices: () => [candidate],
      onInlineSwap: () => undefined,
    }));

    expect(html).toContain("SK");
    expect(html).toContain("SFT");
    expect(html).toContain("TA");
    expect(html).toContain("TDDST");
    expect((html.match(/>38</g) ?? []).length).toBe(2);
    expect((html.match(/>20</g) ?? []).length).toBe(2);
    expect((html.match(/>3</g) ?? []).length).toBe(2);
  });
});
