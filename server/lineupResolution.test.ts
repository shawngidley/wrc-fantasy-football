import { describe, expect, it } from "vitest";
import { selectEffectiveLineupRows, type StoredLineupRow } from "./lineupResolution";

const row = (team_id: string, week: number, player_id: string, slot = "QB", is_bench = false): StoredLineupRow =>
  ({ team_id, week, slot, player_id, player_name: player_id, is_bench });

describe("selectEffectiveLineupRows", () => {
  it("uses the exact week when it was saved", () => {
    const rows = [row("t1", 1, "a"), row("t1", 2, "b")];
    const out = selectEffectiveLineupRows(rows, 2, new Map());
    expect(out.map(r => r.player_id)).toEqual(["b"]);
    expect(out[0].source_week).toBe(2);
  });

  it("carries the most recent earlier week forward when the week was never saved", () => {
    const rows = [row("t1", 1, "a"), row("t1", 1, "c", "RB", true)];
    const roster = new Map([["t1", new Set(["a", "c"])]]);
    const out = selectEffectiveLineupRows(rows, 3, roster);
    expect(out.map(r => r.player_id).sort()).toEqual(["a", "c"]);
    expect(out.every(r => r.source_week === 1)).toBe(true);
  });

  it("drops carried-forward players no longer on the roster", () => {
    const rows = [row("t1", 1, "a"), row("t1", 1, "gone", "RB")];
    const roster = new Map([["t1", new Set(["a"])]]);
    const out = selectEffectiveLineupRows(rows, 2, roster);
    expect(out.map(r => r.player_id)).toEqual(["a"]);
  });

  it("ignores rows saved for a later week", () => {
    const rows = [row("t1", 1, "a"), row("t1", 3, "future")];
    const out = selectEffectiveLineupRows(rows, 2, new Map([["t1", new Set(["a"])]]));
    expect(out.map(r => r.player_id)).toEqual(["a"]);
  });

  it("resolves each team independently", () => {
    const rows = [row("t1", 2, "a"), row("t2", 1, "b")];
    const roster = new Map([["t2", new Set(["b"])]]);
    const out = selectEffectiveLineupRows(rows, 2, roster);
    expect(out.find(r => r.team_id === "t1")?.source_week).toBe(2);
    expect(out.find(r => r.team_id === "t2")?.source_week).toBe(1);
  });
});
