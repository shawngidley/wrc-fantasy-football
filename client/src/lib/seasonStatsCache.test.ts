import { describe, expect, it } from "vitest";
import { readSeasonStatsCache, SEASON_STATS_CACHE_TTL_MS, writeSeasonStatsCache, type StorageLike } from "./seasonStatsCache";
import type { PlayerSeasonStats } from "./playerSeasonStats";

const blankStats: PlayerSeasonStats = { passYds: 0, passTD: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTD: 0, targets: 0, receptions: 0, recYds: 0, recTD: 0, fumblesLost: 0, fgMade: 0, fgAtt: 0, xpMade: 0, xpAtt: 0, sacks: 0, safeties: 0, takeaways: 0, dstTD: 0, gp: 17, wrcPts: 123.4, ptsPerGame: 7.3 };

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

describe("season stats persistent cache", () => {
  it("restores valid saved stats across a new page load", () => {
    const storage = memoryStorage();
    writeSeasonStatsCache(storage, "Cameron Dicker", { stats: blankStats }, 10_000);
    expect(readSeasonStatsCache(storage, "Cameron Dicker", 10_001)?.stats.wrcPts).toBe(123.4);
  });

  it("rejects stale cached stats after the versioned cache TTL", () => {
    const storage = memoryStorage();
    writeSeasonStatsCache(storage, "Cameron Dicker", { stats: blankStats }, 10_000);
    expect(readSeasonStatsCache(storage, "Cameron Dicker", 10_000 + SEASON_STATS_CACHE_TTL_MS)).toBeNull();
  });
});
