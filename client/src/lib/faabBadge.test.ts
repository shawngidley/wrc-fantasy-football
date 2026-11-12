import { describe, expect, it } from "vitest";
import { faabForTeam, type FaabTeamRow } from "./faabBadge";

const ROWS: FaabTeamRow[] = [
  { id: "team-shawn", faab: 173 },
  { id: "team-greg", faab: 0 },
];

describe("faabForTeam", () => {
  it("returns a team's remaining balance", () => {
    expect(faabForTeam(ROWS, "team-shawn")).toBe(173);
  });

  // The regression this guards: a team that has spent its whole budget is the
  // one everyone most wants to see, and a falsy-fallback lookup
  // (`hit?.faab || null`) hides exactly that team. 0 must come back as 0.
  it("returns 0 for a team with no FAAB left, not null", () => {
    expect(faabForTeam(ROWS, "team-greg")).toBe(0);
  });

  it("returns null for a team the balances query has no row for", () => {
    // Before the query resolves there are no rows at all, and the badge has to
    // stay hidden rather than render "$null FAAB".
    expect(faabForTeam([], "team-shawn")).toBeNull();
    expect(faabForTeam(ROWS, "team-nobody")).toBeNull();
  });
});
