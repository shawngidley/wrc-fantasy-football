import { describe, expect, it } from "vitest";
import { resolveStarterPlayerInfo } from "./useOwnerMatchupScore";

describe("resolveStarterPlayerInfo", () => {
  // Confirmed live: a lineup row referencing player_id "dp10172" and
  // player_name "KC Chiefs", while the actual players table row has id
  // "scottn-kansas-city-chiefs" and name "Kansas City Chiefs" -- a
  // draft-time identifier/short-name mismatch against the current
  // roster row. Neither the id nor the name matches at all.
  const kcPlayerRow = { id: "scottn-kansas-city-chiefs", name: "Kansas City Chiefs", position: "DST", nfl_team: "KAN", team_id: "team-scottm" };
  const allPlayerRows = [
    kcPlayerRow,
    { id: "jason-detroit-lions", name: "Detroit Lions", position: "DST", nfl_team: "DET", team_id: "team-shawn" },
  ];
  const playerById = new Map(allPlayerRows.map(p => [p.id, p]));
  const playerByName = new Map(allPlayerRows.map(p => [p.name, p]));

  it("resolves via player_id when it matches", () => {
    const row = { team_id: "team-scottm", player_id: "scottn-kansas-city-chiefs", player_name: "Kansas City Chiefs", slot: "DST", is_bench: false };
    const result = resolveStarterPlayerInfo(row, "team-scottm", playerById, playerByName, allPlayerRows);
    expect(result?.position).toBe("DST");
    expect(result?.nfl_team).toBe("KAN");
  });

  it("falls back to name matching when player_id doesn't match", () => {
    const row = { team_id: "team-scottm", player_id: "some-stale-id", player_name: "Kansas City Chiefs", slot: "DST", is_bench: false };
    const result = resolveStarterPlayerInfo(row, "team-scottm", playerById, playerByName, allPlayerRows);
    expect(result?.position).toBe("DST");
  });

  it("falls back to team_id + position === DST when both id and name fail (the exact confirmed bug)", () => {
    const row = { team_id: "team-scottm", player_id: "dp10172", player_name: "KC Chiefs", slot: "DST", is_bench: false };
    const result = resolveStarterPlayerInfo(row, "team-scottm", playerById, playerByName, allPlayerRows);
    expect(result?.position).toBe("DST");
    expect(result?.nfl_team).toBe("KAN");
    expect(result?.id).toBe("scottn-kansas-city-chiefs");
  });

  it("does NOT apply the DST team+position fallback for a non-DST slot", () => {
    const row = { team_id: "team-scottm", player_id: "some-stale-id", player_name: "Some Player", slot: "WR", is_bench: false };
    const result = resolveStarterPlayerInfo(row, "team-scottm", playerById, playerByName, allPlayerRows);
    expect(result).toBeUndefined();
  });

  it("does not match a DST belonging to a different team", () => {
    const row = { team_id: "team-scottm", player_id: "dp10172", player_name: "KC Chiefs", slot: "DST", is_bench: false };
    const result = resolveStarterPlayerInfo(row, "team-shawn", playerById, playerByName, allPlayerRows);
    // team-shawn's own DST (Detroit Lions), not KC
    expect(result?.name).toBe("Detroit Lions");
  });
});
