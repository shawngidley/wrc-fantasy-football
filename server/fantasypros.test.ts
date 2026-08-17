import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFantasyProsInjuries,
  getFantasyProsNews,
  getFantasyProsProjections,
  getFantasyProsRanks,
} from "./fantasypros";

describe("FantasyPros server adapters", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/news?")) {
        return new Response(JSON.stringify({ items: [{ id: 17, player_id: 42, player_name: "Example Receiver", team_id: "DET", title: "Practice update", desc: "Healthy", impact: "Startable", author: "Analyst", created: "2026-08-17T12:00:00Z", link: "https://example.com/news", categories: ["NFL"] }] }));
      }
      if (url.includes("/injuries?")) {
        return new Response(JSON.stringify({ injuries: [{ player_id: 42, name: "Example Receiver", team_id: "DET", position_id: "WR", status: "Questionable", status_short: "Q", injury_type: "Hamstring", practice_report_injury_type: "Limited", comment: "Limited practice", injury_update_date: "2026-08-17", probability_of_playing: 60, practice_1: "Limited", practice_2: "" }] }));
      }
      if (url.includes("consensus-rankings")) {
        return new Response(JSON.stringify({ players: [{ player_id: 42, player_name: "Example Quarterback", player_team_id: "DET", player_position_id: "QB", rank_ecr: 8, pos_rank: "QB8", tier: 2, player_bye_week: 8 }] }));
      }
      if (url.includes("projections")) {
        return new Response(JSON.stringify({ players: [{ fpid: 42, name: "Example Quarterback", team_id: "DET", position_id: "QB", stats: [{ points: 20.4, points_ppr: 20.4, pass_yds: 260, pass_td: 2, interceptions: 1, rush_yds: 12, rush_td: 0 }] }] }));
      }
      return new Response("Not found", { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes NFL news, injury, ranking, and projection data without exposing the key", async () => {
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
    expect(injuries[0]).toMatchObject({ name: "Example Receiver", status: "Questionable" });
    expect(ranks[0]).toMatchObject({ name: "Example Quarterback", ecr: 8, positionRank: "QB8" });
    expect(projections[0]).toMatchObject({ name: "Example Quarterback", points: 20.4, passYards: 260 });
  }, 30_000);
});
