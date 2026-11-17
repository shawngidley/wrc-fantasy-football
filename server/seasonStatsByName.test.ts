import { describe, expect, it } from "vitest";
import { matchRowsToRequestedNames } from "./seasonStatsByName";

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
