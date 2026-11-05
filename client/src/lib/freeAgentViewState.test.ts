import { describe, expect, it } from "vitest";
import { AVAILABLE_STATS_YEARS } from "@/lib/scheduleData2026";
import { FREE_AGENT_VIEW_KEY, readFreeAgentViewState, writeFreeAgentViewState, type FreeAgentViewState } from "./freeAgentViewState";

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(FREE_AGENT_VIEW_KEY, initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const wrView: FreeAgentViewState = {
  posFilter: "WR", search: "jam", sortKey: "proj", sortDirection: "desc",
  playerScope: "all", activeView: "pool", activeTab: "pool", selectedStatsYear: 2026, scrollY: 640,
};

describe("free agent view state", () => {
  it("returns the same view that was saved (WR sorted by projection)", () => {
    const storage = memoryStorage();
    writeFreeAgentViewState(wrView, storage);
    expect(readFreeAgentViewState(storage)).toEqual(wrView);
  });

  it("returns null when nothing was saved, so the page uses its defaults", () => {
    expect(readFreeAgentViewState(memoryStorage())).toBeNull();
  });

  it("ignores damaged text", () => {
    expect(readFreeAgentViewState(memoryStorage("{not json"))).toBeNull();
  });

  it("replaces unknown values with defaults instead of trusting them", () => {
    const storage = memoryStorage(JSON.stringify({ posFilter: "XYZ", sortDirection: "sideways", playerScope: 7, scrollY: -5, selectedStatsYear: "2026" }));
    expect(readFreeAgentViewState(storage)).toMatchObject({
      posFilter: "SFLEX", sortDirection: "desc", playerScope: "fa", scrollY: 0, selectedStatsYear: null, sortKey: "wrcPts",
    });
  });

  // A year the page no longer offers would leave the stats-year select with no
  // matching option and query a season with no data, so it falls back too.
  it("only restores a stats year the page still offers", () => {
    for (const year of AVAILABLE_STATS_YEARS) {
      expect(readFreeAgentViewState(memoryStorage(JSON.stringify({ selectedStatsYear: year })))?.selectedStatsYear).toBe(year);
    }
    expect(readFreeAgentViewState(memoryStorage(JSON.stringify({ selectedStatsYear: 2019 })))?.selectedStatsYear).toBeNull();
    expect(readFreeAgentViewState(memoryStorage(JSON.stringify({ selectedStatsYear: 2031 })))?.selectedStatsYear).toBeNull();
  });

  it("does nothing when storage is unavailable", () => {
    expect(readFreeAgentViewState(null)).toBeNull();
    expect(() => writeFreeAgentViewState(wrView, null)).not.toThrow();
  });

  it("does not throw when storage refuses the write", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => writeFreeAgentViewState(wrView, full)).not.toThrow();
  });
});
