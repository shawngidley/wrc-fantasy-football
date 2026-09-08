import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasWeekKickedOff } from "./nflWeekKickoffCheck";

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

  function mockGames(games: Array<{ gameStatus?: string }>) {
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
});
