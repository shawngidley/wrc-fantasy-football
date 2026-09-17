import { describe, expect, it } from "vitest";
import { findPlayerRowByName, makePlayerId, type PlayersRow } from "./rosterPlayerForTeam";

const rows: PlayersRow[] = [
  { id: "shawn-tampa-bay-buccaneers", team_id: null, name: "Tampa Bay Buccaneers", dropped_at: null },
  // Real Sep 17, 2026 data: the stored name carries a leading line break.
  { id: "keith--de-zhaun-stribling", team_id: "team-keith", name: "\nDe'Zhaun Stribling", dropped_at: null },
  { id: "jonas-deebo-samuel", team_id: null, name: "Deebo Samuel", dropped_at: null },
  { id: "keith-brock-bowers", team_id: "team-keith", name: "Brock Bowers", dropped_at: null },
];

describe("findPlayerRowByName", () => {
  it("matches a DST bid name to the full team name stored in players", () => {
    // The Free Agents list calls it "TB Buccaneers"; the players table row
    // is "Tampa Bay Buccaneers". Sep 17, 2026: an exact-name UPDATE missed
    // this and Millertime's winning bid never landed.
    expect(findPlayerRowByName(rows, "TB Buccaneers")?.id).toBe("shawn-tampa-bay-buccaneers");
  });

  it("tolerates a stray line break in the stored name", () => {
    expect(findPlayerRowByName(rows, "De'Zhaun Stribling")?.id).toBe("keith--de-zhaun-stribling");
  });

  it("ignores generational suffixes", () => {
    expect(findPlayerRowByName(rows, "Deebo Samuel Sr.")?.id).toBe("jonas-deebo-samuel");
  });

  it("returns null for a player who has never been rostered", () => {
    expect(findPlayerRowByName(rows, "Devaughn Vele")).toBeNull();
  });
});

describe("makePlayerId", () => {
  it("matches the open-waiver add convention", () => {
    expect(makePlayerId("team-keith", "Devaughn Vele")).toBe("keith-devaughn-vele");
    expect(makePlayerId("team-jonas", "Deebo Samuel Sr.")).toBe("jonas-deebo-samuel-sr");
  });
});
