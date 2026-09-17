import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_KEYS } from "./fantasyprosFetcher";
import { getFantasyProsInjuries, getFantasyProsNews, getFantasyProsProjections, getFantasyProsRanks } from "./fantasypros";

const cacheRows = new Map<string, unknown>();

// fantasypros.ts must never touch the network -- only read
// fantasypros_cache via supabaseAdmin. This mock stands in for that table:
// `cacheRows` is keyed exactly like fantasypros_cache.key.
vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, key: string) => ({
          maybeSingle: async () => {
            if (table !== "fantasypros_cache") return { data: null, error: null };
            return { data: cacheRows.has(key) ? { payload: cacheRows.get(key) } : null, error: null };
          },
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  cacheRows.clear();
});

describe("FantasyPros cache reads", () => {
  it("normalizes news, injury, ranking, and projection data from the cache without ever calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    cacheRows.set(CACHE_KEYS.news(), { items: [{ id: 17, player_id: 42, player_name: "Example Receiver", team_id: "DET", title: "Practice update", desc: "Healthy", impact: "Startable", author: "Analyst", created: "2026-08-17T12:00:00Z", link: "https://example.com/news", categories: ["NFL"] }] });
    cacheRows.set(CACHE_KEYS.injuries(2026, 1), { injuries: [{ player_id: 42, name: "Example Receiver", team_id: "DET", position_id: "WR", status: "Questionable", status_short: "Q", injury_type: "Hamstring", practice_report_injury_type: "Limited", comment: "Limited practice", injury_update_date: "2026-08-17", probability_of_playing: 60, practice_1: "Limited", practice_2: "" }] });
    cacheRows.set(CACHE_KEYS.ranks("QB", 0), { players: [{ player_id: 42, player_name: "Example Quarterback", player_team_id: "DET", player_position_id: "QB", rank_ecr: 8, pos_rank: "QB8", tier: 2, player_bye_week: 8 }] });
    cacheRows.set(CACHE_KEYS.projections("QB", 0), { players: [{ fpid: 42, name: "Example Quarterback", team_id: "DET", position_id: "QB", stats: [{ points: 20.4, points_ppr: 20.4, pass_yds: 260, pass_td: 2, interceptions: 1, rush_yds: 12, rush_td: 0 }] }] });

    const [news, injuries, ranks, projections] = await Promise.all([
      getFantasyProsNews(5),
      getFantasyProsInjuries(2026, 1),
      getFantasyProsRanks("QB", 0),
      getFantasyProsProjections("QB", 0),
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(news.every(item => item.title && !Object.hasOwn(item, "apiKey"))).toBe(true);
    expect(injuries[0]).toMatchObject({ name: "Example Receiver", status: "Questionable" });
    expect(ranks[0]).toMatchObject({ name: "Example Quarterback", ecr: 8, positionRank: "QB8" });
    expect(projections[0]).toMatchObject({ name: "Example Quarterback", points: 20.4, passYards: 260 });

    vi.unstubAllGlobals();
  });

  it("filters the cached league-wide news by playerId instead of making a per-player call", async () => {
    cacheRows.set(CACHE_KEYS.news(), {
      items: [
        { id: 1, player_id: 42, player_name: "Player A", title: "News about A", created: "2026-09-01T00:00:00Z" },
        { id: 2, player_id: 99, player_name: "Player B", title: "News about B", created: "2026-09-01T00:00:00Z" },
      ],
    });

    const result = await getFantasyProsNews(10, 99);
    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe("Player B");
  });

  it("returns an empty array, not an error, when a cache key is entirely missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getFantasyProsNews()).toEqual([]);
    expect(await getFantasyProsInjuries(2026, 4)).toEqual([]);
    expect(await getFantasyProsRanks("RB", 4)).toEqual([]);
    expect(await getFantasyProsProjections("RB", 4)).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("serves the stored payload even when it is long past its own TTL -- staleness is the read side's problem to accept, never to block on", async () => {
    // fantasypros.ts never looks at expires_at at all; it has no way to
    // "notice" staleness because it doesn't fetch. This just documents
    // that a cache row's age has no bearing on whether it's served.
    cacheRows.set(CACHE_KEYS.news(), { items: [{ id: 1, player_id: 1, player_name: "Stale Player", title: "Old news", created: "2020-01-01T00:00:00Z" }] });
    const result = await getFantasyProsNews();
    expect(result).toHaveLength(1);
  });
});
