import { describe, expect, it } from "vitest";
import {
  getFantasyProsInjuries,
  getFantasyProsNews,
  getFantasyProsProjections,
  getFantasyProsRanks,
} from "./fantasypros";

describe("FantasyPros server adapters", () => {
  it("retrieves normalized NFL news, injury, ranking, and projection data without exposing the key", async () => {
    const [news, injuries, ranks, projections] = await Promise.all([
      getFantasyProsNews(5),
      getFantasyProsInjuries(2026, 1),
      getFantasyProsRanks("QB", 0),
      getFantasyProsProjections("QB", 0),
    ]);

    expect(Array.isArray(news)).toBe(true);
    expect(Array.isArray(injuries)).toBe(true);
    expect(Array.isArray(ranks)).toBe(true);
    expect(Array.isArray(projections)).toBe(true);
    expect(news.every(item => item.title && !Object.hasOwn(item, "apiKey"))).toBe(true);
  }, 30_000);
});
