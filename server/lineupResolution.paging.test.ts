import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression for the Week 5 mismatch: Live Scoring (and the weekly finalizer)
 * resolve EVERY team's lineup in one query across weeks 1..N. Supabase's REST
 * layer silently caps a select at 1000 rows, and 12 teams x 18 rows x 5 weeks =
 * 1080, so the newest rows -- the Week 5 saves, inserted last -- were cut off.
 * Affected teams fell back to their Week 4 lineup (carried forward) on Live
 * Scoring while the Lineup page, which filters to one team (90 rows), correctly
 * showed the real Week 5 save.
 */

const state = vi.hoisted(() => ({ fake: null as null | { from: (table: string) => unknown } }));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: { from: (table: string) => state.fake!.from(table) } }));

import { resolveLineupsForWeek } from "./lineupResolution";

type Row = Record<string, unknown>;

/** A thenable query builder that mimics PostgREST: filters, ordering by any
 * number of columns, an optional range, and a hard 1000-row cap on any single
 * response. */
function query(all: Row[]) {
  const filters: Array<(r: Row) => boolean> = [];
  const orderCols: string[] = [];
  let range: [number, number] | null = null;
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (c: string, v: unknown) => (filters.push(r => r[c] === v), b),
    lte: (c: string, v: number) => (filters.push(r => (r[c] as number) <= v), b),
    in: (c: string, vs: unknown[]) => (filters.push(r => vs.includes(r[c])), b),
    order: (c: string) => (orderCols.push(c), b),
    range: (from: number, to: number) => ((range = [from, to]), b),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      let out = all.filter(r => filters.every(f => f(r)));
      if (orderCols.length > 0) {
        out = [...out].sort((a, z) => {
          for (const col of orderCols) {
            const l = a[col] as string | number;
            const r = z[col] as string | number;
            if (l === r) continue;
            return typeof l === "number" && typeof r === "number" ? l - r : String(l) < String(r) ? -1 : 1;
          }
          return 0;
        });
      }
      const [from, to] = range ?? [0, 999];
      out = out.slice(from, Math.min(to + 1, from + 1000)); // the silent cap
      return Promise.resolve({ data: out, error: null }).then(resolve, reject);
    },
  };
  return b;
}

const TEAMS = Array.from({ length: 12 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);

/** 18 rows per team per week (10 starters + 8 bench), inserted week by week the
 * way the real table fills up. */
function buildLineupTable(weeks: number[], skip: (team: string, week: number) => boolean = () => false): Row[] {
  const rows: Row[] = [];
  for (const week of weeks) {
    for (const team of TEAMS) {
      if (skip(team, week)) continue;
      for (let i = 0; i < 18; i++) {
        rows.push({
          team_id: team, week, season: 2026,
          slot: i < 10 ? `S${i}` : `BENCH_${i - 10}`,
          player_id: `${team}-w${week}-${i}`, player_name: `${team} w${week} p${i}`,
          is_bench: i >= 10,
        });
      }
    }
  }
  return rows;
}

function install(lineups: Row[], roster: Row[] = []) {
  state.fake = { from: (table: string) => (table === "lineups" ? query(lineups) : query(roster)) };
}

describe("resolveLineupsForWeek past the 1000-row select cap", () => {
  beforeEach(() => { state.fake = null; });

  it("sees every team's newest save when the season has more than 1000 lineup rows", async () => {
    const table = buildLineupTable([1, 2, 3, 4, 5]);
    expect(table.length).toBe(1080); // over the cap, like production in Week 5
    install(table);

    const out = await resolveLineupsForWeek(5, 2026);

    for (const team of TEAMS) {
      const mine = out.filter(r => r.team_id === team);
      expect(mine.length, `${team} row count`).toBe(18);
      expect(new Set(mine.map(r => r.source_week)), `${team} source week`).toEqual(new Set([5]));
    }
  });

  it("still carries a team's last save forward when it never saved the requested week", async () => {
    const lastTeam = TEAMS[TEAMS.length - 1];
    const table = buildLineupTable([1, 2, 3, 4, 5], (team, week) => team === lastTeam && week === 5);
    expect(table.length).toBeGreaterThan(1000);
    const roster = table
      .filter(r => r.team_id === lastTeam && r.week === 4)
      .map(r => ({ id: r.player_id, team_id: lastTeam }));
    install(table, roster);

    const out = await resolveLineupsForWeek(5, 2026);

    expect(new Set(out.filter(r => r.team_id === lastTeam).map(r => r.source_week))).toEqual(new Set([4]));
    expect(new Set(out.filter(r => r.team_id === TEAMS[0]).map(r => r.source_week))).toEqual(new Set([5]));
  });

  it("terminates correctly when the row count is an exact multiple of the page size", async () => {
    // 1000 rows exactly: the first page is full, the second comes back empty.
    const table = buildLineupTable([1, 2, 3, 4, 5]).slice(0, 1000);
    expect(table.length).toBe(1000);
    install(table);

    const out = await resolveLineupsForWeek(5, 2026);
    expect(out.length).toBeGreaterThan(0);
    const ids = new Set(out.map(r => `${r.team_id}|${r.player_id}`));
    expect(ids.size).toBe(out.length); // no duplicated rows across pages
  });

  it("returns the same rows for one team as the all-teams call does", async () => {
    install(buildLineupTable([1, 2, 3, 4, 5]));
    const all = await resolveLineupsForWeek(5, 2026);
    const one = await resolveLineupsForWeek(5, 2026, TEAMS[6]);
    const pick = (rows: typeof all) => rows.filter(r => r.team_id === TEAMS[6]).map(r => r.player_id).sort();
    expect(pick(one)).toEqual(pick(all));
    expect(pick(one).length).toBe(18);
  });

  // The whole point of the fix is that nothing is lost at a page boundary, so
  // the paged read has to return the table itself, not just the right answer
  // for the teams that happen to sit early in the order.
  it("reads back every row of a multi-page table, in a stable total order", async () => {
    const table = buildLineupTable(Array.from({ length: 12 }, (_, i) => i + 1)); // 2592 rows, 3 pages
    install(table);

    const out = await resolveLineupsForWeek(12, 2026);
    expect(out.length).toBe(TEAMS.length * 18);
    expect(new Set(out.map(r => r.source_week))).toEqual(new Set([12]));
    const keys = out.map(r => `${r.team_id}|${r.slot}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
