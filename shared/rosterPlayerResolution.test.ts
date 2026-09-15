import { describe, expect, it } from "vitest";
import { resolveRosterPlayerForLineupEntry, type RosterPlayerRow } from "./rosterPlayerResolution";
import { normalizePlayerName } from "./playerNameMatch";

describe("resolveRosterPlayerForLineupEntry", () => {
  // A DST fixture used across several tests below. Originally set up to
  // reproduce a confirmed live mismatch (a lineup row saved with
  // player_id "dp10172" and player_name "KC Chiefs" against a players
  // table row with id "scottn-kansas-city-chiefs" and name "Kansas City
  // Chiefs") -- since fixed on the id side by this function's player_id
  // step, and on the "KC Chiefs" vs "Kansas City Chiefs" name side by an
  // existing alias in playerNameMatch.ts (see the dedicated test for
  // that below). Kept here as a plain DST fixture for the remaining
  // fallback tests, which use a different, genuinely alias-unmatched
  // name to isolate that behavior.
  const kcPlayerRow: RosterPlayerRow = { id: "scottn-kansas-city-chiefs", name: "Kansas City Chiefs", position: "DST", nfl_team: "KAN", team_id: "team-scottm" };
  const detroitPlayerRow: RosterPlayerRow = { id: "jason-detroit-lions", name: "Detroit Lions", position: "DST", nfl_team: "DET", team_id: "team-shawn" };
  // Confirmed live separately: "James Cook III" (lineup) vs "James Cook"
  // (roster) -- a generational-suffix mismatch, not a completely
  // different name. This is the exact capability the old client-side
  // implementation lacked (its name fallback was an exact match only);
  // unifying onto the server's suffix-aware version fixes it here too.
  const cookPlayerRow: RosterPlayerRow = { id: "cook-buf", name: "James Cook", position: "RB", nfl_team: "BUF", team_id: "team-scottm" };
  const allPlayerRows = [kcPlayerRow, detroitPlayerRow, cookPlayerRow];
  const playerById = new Map(allPlayerRows.map(p => [p.id!, p]));
  const playerByNormalizedName = new Map(allPlayerRows.map(p => [normalizePlayerName(p.name), p]));

  it("resolves via player_id when it matches", () => {
    const entry = { team_id: "team-scottm", player_id: "scottn-kansas-city-chiefs", player_name: "Kansas City Chiefs", slot: "DST" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    expect(result?.position).toBe("DST");
    expect(result?.nfl_team).toBe("KAN");
  });

  it("falls back to name matching when player_id doesn't match", () => {
    const entry = { team_id: "team-scottm", player_id: "some-stale-id", player_name: "Kansas City Chiefs", slot: "DST" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    expect(result?.position).toBe("DST");
  });

  it("falls back to team_id + position === DST when both id and name fail entirely (a completely unrelated saved name, not just a suffix or alias difference)", () => {
    const entry = { team_id: "team-scottm", player_id: "dp10172", player_name: "Some Unrelated Saved Name", slot: "DST" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    expect(result?.position).toBe("DST");
    expect(result?.nfl_team).toBe("KAN");
    expect(result?.id).toBe("scottn-kansas-city-chiefs");
  });

  it("does NOT apply the DST team+position fallback for a non-DST slot", () => {
    const entry = { team_id: "team-scottm", player_id: "some-stale-id", player_name: "Some Player", slot: "WR" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    expect(result).toBeUndefined();
  });

  it("does not match a DST belonging to a different team", () => {
    const entry = { team_id: "team-shawn", player_id: "dp10172", player_name: "Some Unrelated Saved Name", slot: "DST" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    // team-shawn's own DST (Detroit Lions), not KC
    expect(result?.name).toBe("Detroit Lions");
  });

  // Confirmed with a real alias already in playerNameMatch.ts:
  // "KC Chiefs" and "Kansas City Chiefs" now correctly match directly
  // by name (kansascitychiefs -> kcchiefs), without ever needing the
  // DST team+position fallback -- a genuine improvement from unifying
  // onto the shared, alias-aware normalizer.
  it("resolves 'KC Chiefs' directly by name via the existing kansascitychiefs alias, with no fallback needed", () => {
    const entry = { team_id: "team-scottm", player_name: "KC Chiefs", slot: "DST" };
    const result = resolveRosterPlayerForLineupEntry(entry, new Map(), playerByNormalizedName, allPlayerRows);
    expect(result?.name).toBe("Kansas City Chiefs");
  });

  // The capability closed by unifying the two prior, separate
  // implementations: the old client-side version's name fallback was an
  // exact match only and would have returned undefined here.
  it("resolves a suffix-mismatched name via normalization, with no player_id involved at all", () => {
    const entry = { team_id: "team-scottm", player_name: "James Cook III", slot: "RB" };
    const result = resolveRosterPlayerForLineupEntry(entry, playerById, playerByNormalizedName, allPlayerRows);
    expect(result?.name).toBe("James Cook");
    expect(result?.nfl_team).toBe("BUF");
  });

  it("works with no player_id map entries at all -- the server-side caller doesn't track player_id", () => {
    const emptyPlayerById = new Map<string, RosterPlayerRow>();
    const entry = { team_id: "team-scottm", player_name: "James Cook III", slot: "RB" };
    const result = resolveRosterPlayerForLineupEntry(entry, emptyPlayerById, playerByNormalizedName, allPlayerRows);
    expect(result?.name).toBe("James Cook");
  });
});
