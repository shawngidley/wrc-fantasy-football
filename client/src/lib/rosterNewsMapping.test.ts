import { describe, expect, it } from "vitest";
import { mapRosterNewsForDisplay } from "./rosterNewsMapping";

describe("mapRosterNewsForDisplay", () => {
  it("renders named FantasyPros player-specific news against the matching roster player", () => {
    const result = mapRosterNewsForDisplay([
      { playerName: "Alec Pierce", team: "IND", title: "Alec Pierce update", description: "Description", impact: "Fantasy impact", published: "2026-08-11T17:05:36Z", link: "https://example.test/story" },
    ], [{ name: "Alec Pierce", pos: "WR", nflTeam: "IND" }]);

    expect(result).toEqual([{
      playerName: "Alec Pierce", pos: "WR", nflTeam: "IND", headline: "Alec Pierce update", description: "Fantasy impact", published: "2026-08-11T17:05:36Z", url: "https://example.test/story", source: "FantasyPros",
    }]);
  });
});
