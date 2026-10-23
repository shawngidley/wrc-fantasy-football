import { describe, expect, it } from "vitest";
import { findMovedLineupPlayers } from "./lineupMoves";
import type { RosterPlayerWithId } from "./effectiveStarters";

const P = (id: string, name: string, position: string): RosterPlayerWithId => ({ id, name, position, nfl_team: "X", team_id: "t" });
const a = P("1", "Alpha", "RB"), b = P("2", "Bravo", "RB"), c = P("3", "Charlie", "RB"), d = P("4", "Kyle Pitts", "TE");
const roster = [a, b, c, d];
const baseline = [{ slot: "RB", player: a }, { slot: "RB", player: b }];
const r = (slot: string, player_name: string, is_bench = false) => ({ slot, player_name, is_bench });

describe("findMovedLineupPlayers", () => {
  it("finds nobody when the lineup is the same", () => {
    expect(findMovedLineupPlayers(baseline, [r("RB1", "Alpha"), r("RB2", "Bravo"), r("BENCH_0", "Charlie", true), r("BENCH_1", "Kyle Pitts Sr.", true)], roster)).toEqual([]);
  });
  it("finds both players in a bench for starter swap", () => {
    const moved = findMovedLineupPlayers(baseline, [r("RB1", "Charlie"), r("RB2", "Bravo"), r("BENCH_0", "Alpha", true), r("BENCH_1", "Kyle Pitts", true)], roster);
    expect(moved.map(p => p.name).sort()).toEqual(["Alpha", "Charlie"]);
  });
  it("does not count bench reordering or an RB1 to RB2 relabel", () => {
    expect(findMovedLineupPlayers(baseline, [r("RB1", "Bravo"), r("RB2", "Alpha"), r("BENCH_3", "Charlie", true), r("BENCH_0", "Kyle Pitts", true)], roster)).toEqual([]);
  });
  it("treats a player left out of the save as moved to the bench", () => {
    const moved = findMovedLineupPlayers(baseline, [r("RB1", "Alpha"), r("BENCH_0", "Charlie", true), r("BENCH_1", "Kyle Pitts", true)], roster);
    expect(moved.map(p => p.name)).toEqual(["Bravo"]);
  });
});
