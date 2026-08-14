import { describe, expect, it } from "vitest";
import { countEligibleFantasyNews, filterFantasyPositionNews, filterNewsBySource, inferFantasyProsPlayerName } from "./newsSourceFilter";

const items = [
  { playerName: "Mike Evans", pos: "WR", nflTeam: "SF", headline: "FantasyPros update", published: "2026-08-13T12:00:00Z", source: "FantasyPros" as const },
  { playerName: "Mike Evans", pos: "WR", nflTeam: "SF", headline: "Tank01 update", published: "2026-08-13T11:00:00Z", source: "Tank01" as const },
  { playerName: "Mike Evans", pos: "WR", nflTeam: "SF", headline: "ESPN update", published: "2026-08-13T10:00:00Z", source: "ESPN" as const },
];

describe("filterNewsBySource", () => {
  it("defaults source filtering to FantasyPros when requested", () => {
    expect(filterNewsBySource(items, "FANTASYPROS").map(item => item.headline)).toEqual(["FantasyPros update"]);
  });

  it("filters Tank01 independently and All News inclusively", () => {
    expect(filterNewsBySource(items, "TANK01").map(item => item.headline)).toEqual(["Tank01 update"]);
    expect(filterNewsBySource(items, "ALL")).toHaveLength(3);
  });

  it("recovers a player name from generic FantasyPros headlines when needed", () => {
    expect(inferFantasyProsPlayerName("John Michael Schmitz Jr. (concussion) misses practice Wednesday")).toBe("John Michael Schmitz Jr.");
    expect(inferFantasyProsPlayerName("Spencer Rattler to start preseason opener Saturday")).toBe("Spencer Rattler");
    expect(inferFantasyProsPlayerName("Zamir White signing with 49ers")).toBe("Zamir White");
    expect(inferFantasyProsPlayerName("Kenneth Walker III primed for workhorse role")).toBe("Kenneth Walker III");
    expect(inferFantasyProsPlayerName("Chuba Hubbard (hamstring) week-to-week with hamstring injury")).toBe("Chuba Hubbard");
    expect(inferFantasyProsPlayerName("Source: Panthers add to TE room")).toBe("FantasyPros Update");
  });

  it("keeps only QB, RB, WR, TE, and K news items", () => {
    const mixedPositions = [
      ...items,
      { playerName: "Bills D/ST", pos: "DST", nflTeam: "BUF", headline: "Defense update", published: "2026-08-13T09:00:00Z", source: "ESPN" as const },
      { playerName: "Chris Freeman", pos: "", nflTeam: "HOU", headline: "Lineman update", published: "2026-08-13T08:00:00Z", source: "FantasyPros" as const },
      { playerName: "Harrison Butker", pos: "K", nflTeam: "KC", headline: "Kicker update", published: "2026-08-13T07:00:00Z", source: "FantasyPros" as const },
    ];
    expect(filterFantasyPositionNews(mixedPositions).map(item => item.playerName)).toEqual(["Mike Evans", "Mike Evans", "Mike Evans", "Harrison Butker"]);
  });

  it("reconciles the eligible source count with the rendered filtered count", () => {
    const sourceItems = [
      { playerName: "QB", pos: "QB", nflTeam: "A", headline: "", published: "", source: "FantasyPros" as const },
      { playerName: "WR", pos: "WR", nflTeam: "B", headline: "", published: "", source: "FantasyPros" as const },
      { playerName: "CB", pos: "CB", nflTeam: "C", headline: "", published: "", source: "FantasyPros" as const },
      { playerName: "K", pos: "K", nflTeam: "D", headline: "", published: "", source: "FantasyPros" as const },
    ];
    const renderedItems = filterFantasyPositionNews(sourceItems);
    expect(renderedItems).toHaveLength(countEligibleFantasyNews(sourceItems));
    expect(renderedItems.map(item => item.pos)).toEqual(["QB", "WR", "K"]);
  });
});
