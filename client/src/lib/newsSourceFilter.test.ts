import { describe, expect, it } from "vitest";
import { filterNewsBySource, inferFantasyProsPlayerName } from "./newsSourceFilter";

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
    expect(inferFantasyProsPlayerName("Source: Panthers add to TE room")).toBe("FantasyPros Update");
  });
});
