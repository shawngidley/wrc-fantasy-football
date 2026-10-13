import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression for lineups "not carrying over from week to week".
 *
 * Carry-forward used to keep a saved player only if its player_id was exactly a
 * current roster id. Some saved lineups carry draft-pool ids ("dp14127") while
 * the roster row has a different id, so David R's whole Week 5 lineup (17 of 18
 * rows) failed that check and vanished the moment it was carried into Week 6.
 * Every other reader (the weekly finalizer, the matchup score hooks, the Lineup
 * page) already resolves a saved player by normalized name, and the DST slot by
 * the team's own DST, so carry-forward now uses that same resolution.
 */

const state = vi.hoisted(() => ({ fake: null as null | { from: (table: string) => unknown } }));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: { from: (table: string) => state.fake!.from(table) } }));

import { resolveLineupsForWeek, selectEffectiveLineupRows, type StoredLineupRow } from "./lineupResolution";

type Row = Record<string, unknown>;

function query(all: Row[]) {
  const filters: Array<(r: Row) => boolean> = [];
  const orders: string[] = [];
  let range: [number, number] | null = null;
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (c: string, v: unknown) => (filters.push(r => r[c] === v), b),
    lte: (c: string, v: number) => (filters.push(r => (r[c] as number) <= v), b),
    in: (c: string, vs: unknown[]) => (filters.push(r => vs.includes(r[c])), b),
    order: (c: string) => (orders.push(c), b),
    range: (from: number, to: number) => ((range = [from, to]), b),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      let out = all.filter(r => filters.every(f => f(r)));
      out = [...out].sort((a, z) => {
        for (const c of orders) {
          const av = a[c] as string | number, zv = z[c] as string | number;
          if (av < zv) return -1;
          if (av > zv) return 1;
        }
        return 0;
      });
      const [from, to] = range ?? [0, 999];
      out = out.slice(from, Math.min(to + 1, from + 1000));
      return Promise.resolve({ data: out, error: null }).then(resolve, reject);
    },
  };
  return b;
}

const T = "team-davidr";

// David R's saved Week 5 lineup, as it actually sits in the table: draft-pool
// ids on most rows, a suffix in a name, a DST under a different name than the
// roster's, one player no longer on the team, and two rows whose ids do match.
const saved = (slot: string, player_id: string, player_name: string, is_bench = false): Row => ({
  team_id: T, week: 5, season: 2026, slot, player_id, player_name, is_bench,
});
const WEEK5: Row[] = [
  saved("QB", "dp14157", "Dak Prescott"),
  saved("RB1", "dp14174", "Aaron Jones Sr."), // roster: "Aaron Jones"
  saved("RB2", "dp14118", "Omarion Hampton"),
  saved("WR1", "dp14202", "Josh Downs"),
  saved("WR2", "dp14136", "Garrett Wilson"),
  saved("TE", "davidr-travis-kelce", "Travis Kelce"), // id matches
  saved("SFLEX", "dp14226", "Sam Darnold"),
  saved("FLEX", "dp14178", "Dalton Kincaid"),
  saved("K", "dp14243", "Jason Myers"),
  saved("DST", "dp14250", "Pittsburgh Steelers"), // roster names it "PIT Steelers"
  saved("BENCH_0", "dp14127", "DeVonta Smith", true),
  saved("BENCH_1", "dp14151", "Luther Burden III", true), // roster: "Luther Burden"
  saved("BENCH_2", "dp14115", "Saquon Barkley", true),
  saved("BENCH_3", "dp14195", "Quentin Johnston", true),
  saved("BENCH_4", "dp14267", "Isiah Pacheco", true),
  saved("BENCH_5", "dp14274", "Jalen McMillan", true),
  saved("BENCH_6", "davidr-tyler-allgeier", "Tyler Allgeier", true), // id matches
  saved("BENCH_7", "davidr-drew-lock", "Drew Lock", true), // no longer on the roster
].map((r, i) => ({ id: i + 1, ...r }));

const rosterPlayer = (id: string, name: string, position: string): Row => ({ id, name, position, nfl_team: "XXX", team_id: T });
const ROSTER: Row[] = [
  rosterPlayer("davidr-dak-prescott", "Dak Prescott", "QB"),
  rosterPlayer("davidr-aaron-jones", "Aaron Jones", "RB"),
  rosterPlayer("davidr-omarion-hampton", "Omarion Hampton", "RB"),
  rosterPlayer("davidr-josh-downs", "Josh Downs", "WR"),
  rosterPlayer("davidr-garrett-wilson", "Garrett Wilson", "WR"),
  rosterPlayer("davidr-travis-kelce", "Travis Kelce", "TE"),
  rosterPlayer("davidr-sam-darnold", "Sam Darnold", "QB"),
  rosterPlayer("davidr-dalton-kincaid", "Dalton Kincaid", "TE"),
  rosterPlayer("davidr-jason-myers", "Jason Myers", "K"),
  rosterPlayer("davidr-pit-steelers", "PIT Steelers", "DST"),
  rosterPlayer("davidr-devonta-smith", "DeVonta Smith", "WR"),
  rosterPlayer("davidr-luther-burden", "Luther Burden", "WR"),
  rosterPlayer("davidr-saquon-barkley", "Saquon Barkley", "RB"),
  rosterPlayer("davidr-quentin-johnston", "Quentin Johnston", "WR"),
  rosterPlayer("davidr-isiah-pacheco", "Isiah Pacheco", "RB"),
  rosterPlayer("davidr-jalen-mcmillan", "Jalen McMillan", "WR"),
  rosterPlayer("davidr-tyler-allgeier", "Tyler Allgeier", "RB"),
];

describe("carrying a saved lineup into the next week", () => {
  beforeEach(() => {
    state.fake = { from: (table: string) => (table === "lineups" ? query(WEEK5) : query(ROSTER)) };
  });

  it("keeps a lineup saved with stale draft-pool ids, dropping only the player who really left", async () => {
    const out = await resolveLineupsForWeek(6, 2026, T);

    expect(out.every(r => r.source_week === 5)).toBe(true);
    expect(out.length).toBe(17);
    const names = new Set(out.map(r => r.player_name));
    expect(names.has("Drew Lock")).toBe(false); // genuinely off the roster
    expect(names.has("Dak Prescott")).toBe(true); // stale id, name matches
    expect(names.has("Aaron Jones Sr.")).toBe(true); // suffix difference
    expect(names.has("Luther Burden III")).toBe(true);
    expect(names.has("Travis Kelce")).toBe(true); // id already matched
  });

  it("keeps the DST starter when the roster names that team's defense differently", async () => {
    const out = await resolveLineupsForWeek(6, 2026, T);
    expect(out.find(r => r.slot === "DST")?.player_name).toBe("Pittsburgh Steelers");
  });

  it("returns the lineup untouched for the week it was saved (no roster filtering)", async () => {
    const out = await resolveLineupsForWeek(5, 2026, T);
    expect(out.length).toBe(18);
    expect(out.some(r => r.player_name === "Drew Lock")).toBe(true);
  });
});

describe("selectEffectiveLineupRows roster matching", () => {
  const row = (slot: string, player_id: string, player_name: string): StoredLineupRow =>
    ({ team_id: "t1", week: 1, slot, player_id, player_name, is_bench: false });
  const roster = (...players: Array<[string, string, string]>) =>
    new Map([["t1", players.map(([id, name, position]) => ({ id, name, position, nfl_team: "XXX", team_id: "t1" }))]]);

  it("still matches by id alone when no roster detail is supplied (previous behavior)", () => {
    const out = selectEffectiveLineupRows([row("QB", "a", "A")], 2, new Map([["t1", new Set(["a"])]]));
    expect(out.map(r => r.player_id)).toEqual(["a"]);
  });

  it("does not match by name without roster detail, so existing callers are unchanged", () => {
    const out = selectEffectiveLineupRows([row("QB", "stale", "Same Name")], 2, new Map([["t1", new Set(["other"])]]));
    expect(out).toEqual([]);
  });

  it("matches a stale id by name when roster detail is supplied", () => {
    const out = selectEffectiveLineupRows(
      [row("QB", "stale", "Same Name")], 2, new Map([["t1", new Set(["other"])]]),
      roster(["other", "Same Name", "QB"]),
    );
    expect(out.map(r => r.player_name)).toEqual(["Same Name"]);
  });

  it("drops a player whose id and name are both off the roster", () => {
    const out = selectEffectiveLineupRows(
      [row("QB", "gone", "Gone Guy")], 2, new Map([["t1", new Set(["other"])]]),
      roster(["other", "Someone Else", "QB"]),
    );
    expect(out).toEqual([]);
  });

  it("does not use the DST fallback for a bench row, only the DST slot", () => {
    const benchDst = { ...row("BENCH_3", "old-dst", "Old Defense"), is_bench: true };
    const out = selectEffectiveLineupRows(
      [benchDst], 2, new Map([["t1", new Set(["d"])]]),
      roster(["d", "Current Defense", "DST"]),
    );
    expect(out).toEqual([]);
  });

  it("never matches a player against a different team's roster", () => {
    const out = selectEffectiveLineupRows(
      [row("QB", "stale", "Same Name")], 2, new Map(),
      new Map([["t2", [{ id: "x", name: "Same Name", position: "QB", nfl_team: "XXX", team_id: "t2" }]]]),
    );
    expect(out).toEqual([]);
  });
});
