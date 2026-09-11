import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTeamGameStarted } from "./playerGameLock";
import type { NFLMatchupMap } from "@/hooks/useNFLMatchups";

describe("hasTeamGameStarted", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for a team with no matchup this week (bye)", () => {
    expect(hasTeamGameStarted("DAL", {} as NFLMatchupMap)).toBe(false);
  });

  it("returns false before the scheduled kickoff time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z")); // 8:00pm ET
    const matchupMap = { SEA: { opponent: "NE", isHome: true, gameTime: "8:20p", gameDate: "20260909", gameId: "1" } } as NFLMatchupMap;
    expect(hasTeamGameStarted("SEA", matchupMap)).toBe(false);
  });

  it("returns true once the kickoff time has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:32:00Z")); // 8:32pm ET
    const matchupMap = { SEA: { opponent: "NE", isHome: true, gameTime: "8:20p", gameDate: "20260909", gameId: "1" } } as NFLMatchupMap;
    expect(hasTeamGameStarted("SEA", matchupMap)).toBe(true);
  });

  it("correctly handles an 8pm+ ET kickoff (hour-overflow case)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T01:00:00Z")); // 9:00pm ET Sept 13
    const matchupMap = { KC: { opponent: "DEN", isHome: true, gameTime: "8:15p", gameDate: "20260913", gameId: "2" } } as NFLMatchupMap;
    expect(hasTeamGameStarted("KC", matchupMap)).toBe(true);
  });

  it("normalizes team code aliases before matching (e.g. AZ vs ARI)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T20:00:00Z"));
    const matchupMap = { ARI: { opponent: "LAC", isHome: true, gameTime: "1:00p", gameDate: "20260913", gameId: "3" } } as NFLMatchupMap;
    expect(hasTeamGameStarted("AZ", matchupMap)).toBe(true);
  });
});
