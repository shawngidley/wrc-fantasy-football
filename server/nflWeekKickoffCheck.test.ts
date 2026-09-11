import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasWeekKickedOff, hasPlayerTeamGameStarted } from "./nflWeekKickoffCheck";

describe("hasWeekKickedOff", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TANK01_API_KEY;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TANK01_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  function mockGames(games: Array<{ gameStatus?: string; gameDate?: string; gameTime?: string }>) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ body: games }),
    }) as unknown as typeof fetch;
  }

  it("returns false when every game is still Scheduled", async () => {
    mockGames([{ gameStatus: "Scheduled" }, { gameStatus: "Scheduled" }, { gameStatus: "Scheduled" }]);
    expect(await hasWeekKickedOff(1, 2026)).toBe(false);
  });

  it("returns true if any game is In Progress", async () => {
    mockGames([{ gameStatus: "Scheduled" }, { gameStatus: "In Progress" }, { gameStatus: "Scheduled" }]);
    expect(await hasWeekKickedOff(1, 2026)).toBe(true);
  });

  it("returns true if any game is already Final (e.g. an early international game)", async () => {
    mockGames([{ gameStatus: "Final" }, { gameStatus: "Scheduled" }, { gameStatus: "Scheduled" }]);
    expect(await hasWeekKickedOff(1, 2026)).toBe(true);
  });

  it("returns false for an empty game list", async () => {
    mockGames([]);
    expect(await hasWeekKickedOff(1, 2026)).toBe(false);
  });

  it("throws if the Tank01 request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(hasWeekKickedOff(1, 2026)).rejects.toThrow(/Unable to load/);
  });

  it("throws if no API credential is configured", async () => {
    delete process.env.TANK01_API_KEY;
    await expect(hasWeekKickedOff(1, 2026)).rejects.toThrow(/credential is unavailable/);
  });

  describe("time-based fallback signal", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns true once the scheduled kickoff time has passed, even if gameStatus is still stuck on Scheduled", async () => {
      // Reproduces exactly what was observed live in production: Tank01's
      // own gameStatus field still showing "Scheduled" a dozen-plus
      // minutes after a game's actual scheduled kickoff.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T00:32:00Z")); // 8:32pm ET
      mockGames([{ gameStatus: "Scheduled", gameDate: "20260909", gameTime: "8:20p" }]); // 8:20pm ET kickoff
      expect(await hasWeekKickedOff(1, 2026)).toBe(true);
    });

    it("returns false before the scheduled kickoff time, when gameStatus also says Scheduled", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T00:00:00Z")); // 8:00pm ET
      mockGames([{ gameStatus: "Scheduled", gameDate: "20260909", gameTime: "8:20p" }]); // 8:20pm ET kickoff
      expect(await hasWeekKickedOff(1, 2026)).toBe(false);
    });

    it("correctly handles an 8pm+ ET kickoff (the exact hour-overflow bug fixed tonight elsewhere)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-14T01:00:00Z")); // 9:00pm ET Sept 13, after an 8:15pm kickoff
      mockGames([{ gameStatus: "Scheduled", gameDate: "20260913", gameTime: "8:15p" }]);
      expect(await hasWeekKickedOff(1, 2026)).toBe(true);
    });
  });
});

describe("hasPlayerTeamGameStarted", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TANK01_API_KEY;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TANK01_API_KEY = originalKey;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function mockGames(games: Array<{ gameStatus?: string; gameDate?: string; gameTime?: string; home?: string; away?: string }>) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ body: games }),
    }) as unknown as typeof fetch;
  }

  it("returns false for a team on a bye (no game found this week)", async () => {
    mockGames([{ gameStatus: "In Progress", home: "SEA", away: "NE" }]);
    expect(await hasPlayerTeamGameStarted("DAL", 1, 2026)).toBe(false);
  });

  it("returns false when this specific team's game hasn't started, even if others have", async () => {
    mockGames([
      { gameStatus: "In Progress", home: "SEA", away: "NE" },
      { gameStatus: "Scheduled", home: "KC", away: "DEN" },
    ]);
    expect(await hasPlayerTeamGameStarted("KC", 1, 2026)).toBe(false);
  });

  it("returns true when this specific team's game has started", async () => {
    mockGames([
      { gameStatus: "Scheduled", home: "SEA", away: "NE" },
      { gameStatus: "In Progress", home: "KC", away: "DEN" },
    ]);
    expect(await hasPlayerTeamGameStarted("DEN", 1, 2026)).toBe(true);
  });

  it("matches regardless of whether the team is home or away", async () => {
    mockGames([{ gameStatus: "Final", home: "SEA", away: "NE" }]);
    expect(await hasPlayerTeamGameStarted("SEA", 1, 2026)).toBe(true);
    expect(await hasPlayerTeamGameStarted("NE", 1, 2026)).toBe(true);
  });

  it("normalizes team code aliases before matching (e.g. AZ vs ARI)", async () => {
    mockGames([{ gameStatus: "In Progress", home: "ARI", away: "LAC" }]);
    expect(await hasPlayerTeamGameStarted("AZ", 1, 2026)).toBe(true);
  });

  it("falls back to the kickoff-time check when gameStatus still says Scheduled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:32:00Z")); // 8:32pm ET
    mockGames([{ gameStatus: "Scheduled", gameDate: "20260909", gameTime: "8:20p", home: "SEA", away: "NE" }]);
    expect(await hasPlayerTeamGameStarted("SEA", 1, 2026)).toBe(true);
  });
});
