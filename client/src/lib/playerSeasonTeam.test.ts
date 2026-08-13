import { describe, expect, it } from "vitest";
import { getHistoricalSeasonTeam } from "./playerSeasonTeam";

describe("getHistoricalSeasonTeam", () => {
  it("retains the completed season team after a player joins a new current team", () => {
    const history = [{ season: 2025, team: "WSH" }, { season: 2024, team: "WSH" }];
    expect(getHistoricalSeasonTeam(history, 2025)).toBe("WSH");
  });

  it("does not fall back to an unrelated current-team value when history is unavailable", () => {
    expect(getHistoricalSeasonTeam([], 2025)).toBeNull();
  });
});
