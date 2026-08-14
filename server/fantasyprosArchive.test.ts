import { describe, expect, it } from "vitest";
import { fantasyProsArchiveKey, isEligibleFantasyProsNews, mergeFantasyProsNews } from "./fantasyprosArchive";
import type { FantasyProsNewsItem } from "./fantasypros";

const item = (overrides: Partial<FantasyProsNewsItem> = {}): FantasyProsNewsItem => ({
  id: 22,
  playerId: 23021,
  playerName: "Kenneth Walker III",
  team: "SEA",
  position: "RB",
  title: "Kenneth Walker update",
  description: "",
  impact: "",
  author: "FantasyPros",
  published: "2026-08-14T12:00:00.000Z",
  link: "https://www.fantasypros.com/nfl/players/kenneth-walker-iii.php",
  categories: [],
  ...overrides,
});

describe("FantasyPros rolling archive helpers", () => {
  it("keeps only eligible fantasy positions", () => {
    expect(isEligibleFantasyProsNews(item())).toBe(true);
    expect(isEligibleFantasyProsNews(item({ position: "DST" }))).toBe(false);
    expect(isEligibleFantasyProsNews(item({ position: undefined }))).toBe(false);
  });

  it("uses stable deduplication keys", () => {
    expect(fantasyProsArchiveKey(item())).toBe(fantasyProsArchiveKey(item()));
    expect(fantasyProsArchiveKey(item({ id: 23 }))).not.toBe(fantasyProsArchiveKey(item()));
  });

  it("merges current and archived stories without duplicates in reverse chronology", () => {
    const old = item({ id: 21, published: "2026-08-12T12:00:00.000Z" });
    const current = item({ id: 22, published: "2026-08-14T12:00:00.000Z" });
    expect(mergeFantasyProsNews([current], [old, current]).map(row => row.id)).toEqual([22, 21]);
  });
});
