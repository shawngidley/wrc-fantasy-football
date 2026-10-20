import { describe, it, expect } from "vitest";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "@shared/draftPlayerUniverse";
import { resolveDstTeam, dstTeamFullName, dstTeamPlayerId } from "./nflDstTeams";

const universeDsts = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(p => p.pos === "DST");

describe("resolveDstTeam", () => {
  it("resolves every rostered D/ST name in the draft universe", () => {
    expect(universeDsts).toHaveLength(32);
    const unresolved = universeDsts.filter(d => resolveDstTeam(d.name) !== d.nflTeam);
    expect(unresolved.map(d => d.name)).toEqual([]);
  });

  // The league's D/ST names are not uniformly "City Nickname", so a hardcoded
  // list of full names silently fails for these: the player card would fall
  // through to the Tank01 player lookup and show "Player Not Found".
  it("resolves the abbreviated-city names, not just the spelled-out ones", () => {
    expect(resolveDstTeam("GB Packers")).toBe("GB");
    expect(resolveDstTeam("KC Chiefs")).toBe("KC");
    expect(resolveDstTeam("SF 49ers")).toBe("SF");
    expect(resolveDstTeam("NE Patriots")).toBe("NE");
    expect(resolveDstTeam("LA Rams")).toBe("LAR");
    expect(resolveDstTeam("LA Chargers")).toBe("LAC");
    expect(resolveDstTeam("Denver Broncos")).toBe("DEN");
    expect(resolveDstTeam("Jacksonville Jaguars")).toBe("JAC");
  });

  // normalizePlayerName aliases the spelled-out city names to the pool's short
  // forms, so an older DB record or a FantasyPros row naming a defense the long
  // way still lands on the same team.
  it("also resolves the spelled-out form of a short-named defense", () => {
    expect(resolveDstTeam("Green Bay Packers")).toBe("GB");
    expect(resolveDstTeam("Kansas City Chiefs")).toBe("KC");
    expect(resolveDstTeam("San Francisco 49ers")).toBe("SF");
    expect(resolveDstTeam("Los Angeles Rams")).toBe("LAR");
    expect(resolveDstTeam("Tampa Bay Buccaneers")).toBe("TB");
  });

  it("returns null for an individual player and for junk", () => {
    expect(resolveDstTeam("Josh Allen")).toBeNull();
    expect(resolveDstTeam("Patrick Mahomes")).toBeNull();
    expect(resolveDstTeam("")).toBeNull();
    expect(resolveDstTeam(null)).toBeNull();
    expect(resolveDstTeam("Not A Team")).toBeNull();
  });
});

describe("dstTeamFullName", () => {
  // The name has to round-trip exactly, because it is the key used to read that
  // defense's stat lines back out of player_weekly_stats.
  it("round-trips every D/ST code back to the universe's own name", () => {
    for (const dst of universeDsts) {
      expect(dstTeamFullName(dst.nflTeam)).toBe(dst.name);
    }
  });

  it("falls back to the code itself when it is not a D/ST team", () => {
    expect(dstTeamFullName("ZZZ")).toBe("ZZZ");
    expect(dstTeamFullName(null)).toBe("");
  });
});

describe("dstTeamPlayerId", () => {
  // submitFaabBid validates playerId with z.string().min(1), so an empty id
  // would make a bid placed from a defense's card fail server-side.
  it("gives every D/ST code the universe id other surfaces bid with", () => {
    for (const dst of universeDsts) {
      expect(dstTeamPlayerId(dst.nflTeam)).toBe(dst.id);
      expect(dstTeamPlayerId(dst.nflTeam)).not.toBe("");
    }
  });

  it("is empty for a code that is not a D/ST team", () => {
    expect(dstTeamPlayerId("ZZZ")).toBe("");
    expect(dstTeamPlayerId(null)).toBe("");
  });
});
