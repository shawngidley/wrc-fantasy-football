import { describe, expect, it } from "vitest";
import { canScanPositionRows, collectWeeklyRowsForNames, matchRowsToRequestedNames } from "./seasonStatsByName";

const row = (player_name: string, fpg = 0) => ({ player_name, fpg });

describe("matchRowsToRequestedNames", () => {
  // The reported bug: the pool asks "James Cook III"; the row was written
  // under the WRC roster name while he was rostered.
  it("finds a row stored under the roster name when asked by the pool name", () => {
    const matched = matchRowsToRequestedNames([row("James Cook", 14.2)], ["James Cook III"]);
    expect(matched).toEqual([{ name: "James Cook III", row: { player_name: "James Cook", fpg: 14.2 } }]);
  });

  it("keys the result by the name the caller asked for, not the stored name", () => {
    const matched = matchRowsToRequestedNames([row("James Cook")], ["James Cook III"]);
    expect(matched.map(m => m.name)).toEqual(["James Cook III"]);
  });

  it("still matches when the stored name is the longer one", () => {
    const matched = matchRowsToRequestedNames([row("James Cook III", 9)], ["James Cook"]);
    expect(matched[0]).toMatchObject({ name: "James Cook", row: { fpg: 9 } });
  });

  it("matches a nickname alias", () => {
    const matched = matchRowsToRequestedNames([row("Kenny Gainwell", 7.5)], ["Kenneth Gainwell"]);
    expect(matched[0]).toMatchObject({ name: "Kenneth Gainwell", row: { fpg: 7.5 } });
  });

  // An exact spelling must win, or two rows that normalize alike could hand a
  // player the other one's stat line.
  it("prefers an exact spelling over a row that merely normalizes the same", () => {
    const rows = [row("Michael Carter II", 3), row("Michael Carter", 11)];
    const matched = matchRowsToRequestedNames(rows, ["Michael Carter", "Michael Carter II"]);
    const byName = Object.fromEntries(matched.map(m => [m.name, m.row.fpg]));
    expect(byName["Michael Carter"]).toBe(11);
    expect(byName["Michael Carter II"]).toBe(3);
  });

  it("omits a requested name with no row at all", () => {
    const matched = matchRowsToRequestedNames([row("James Cook")], ["Nobody Here"]);
    expect(matched).toEqual([]);
  });

  it("handles empty inputs", () => {
    expect(matchRowsToRequestedNames([], ["A B"])).toEqual([]);
    expect(matchRowsToRequestedNames([row("A B")], [])).toEqual([]);
  });
});

describe("collectWeeklyRowsForNames", () => {
  const week = (player_name: string, w: number) => ({ player_name, week: w });

  it("returns every week stored under the roster spelling, keyed by the name asked for", () => {
    const rows = [week("Kaimi Fairbairn", 1), week("Kaimi Fairbairn", 2), week("Tyler Bass", 1)];
    const result = collectWeeklyRowsForNames(rows, ["Ka'imi Fairbairn"]);
    expect(result["Ka'imi Fairbairn"]).toEqual([week("Kaimi Fairbairn", 1), week("Kaimi Fairbairn", 2)]);
  });

  it("prefers an exact spelling and leaves unknown names out", () => {
    const rows = [week("Tyler Bass", 1), week("Tyler Bass", 2)];
    const result = collectWeeklyRowsForNames(rows, ["Tyler Bass", "Nobody Here"]);
    expect(result["Tyler Bass"]).toHaveLength(2);
    expect("Nobody Here" in result).toBe(false);
  });

  // The whole point of collecting by stored name rather than returning the one
  // matched row: a season total built from a single week would be badly wrong.
  it("does not stop at the first matching week", () => {
    const rows = [week("Kaimi Fairbairn", 1), week("Kaimi Fairbairn", 7), week("Kaimi Fairbairn", 9)];
    expect(collectWeeklyRowsForNames(rows, ["Ka'imi Fairbairn"])["Ka'imi Fairbairn"]).toHaveLength(3);
  });

  it("keeps two players apart when one's name merely normalizes close", () => {
    const rows = [week("James Cook", 1), week("James Cook III", 2)];
    const result = collectWeeklyRowsForNames(rows, ["James Cook III"]);
    // Exact spelling wins, so the III rows are not merged with the plain ones.
    expect(result["James Cook III"]).toEqual([week("James Cook III", 2)]);
  });
});

describe("canScanPositionRows", () => {
  it("allows the one-per-team positions the player card needs", () => {
    expect(canScanPositionRows("K")).toBe(true);
    expect(canScanPositionRows("DST")).toBe(true);
  });

  // weeklyStats is public and takes the position from the caller, so an
  // unbounded position would let anyone trigger a multi-page scan.
  it("refuses positions with hundreds of players, and a missing one", () => {
    for (const pos of ["WR", "RB", "QB", "TE", "", undefined]) {
      expect(canScanPositionRows(pos)).toBe(false);
    }
  });
});
