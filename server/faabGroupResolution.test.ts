import { describe, expect, it } from "vitest";
import { resolveFaabGroups, type GroupedFaabBid } from "./faabGroupResolution";
import { type TeamStandingForTiebreak } from "./faabResolution";

// Every team gets an identical .500-ish standing so bid AMOUNT decides
// outcomes in these tests, except where a test deliberately probes ties.
function standings(teamIds: string[]): Map<string, TeamStandingForTiebreak> {
  return new Map(teamIds.map(id => [id, { wins: 5, losses: 5, ties: 0, pointsFor: 800 }]));
}

function bid(partial: Partial<GroupedFaabBid> & Pick<GroupedFaabBid, "id" | "teamId" | "bidAmount" | "playerKey">): GroupedFaabBid {
  return {
    groupId: partial.groupId ?? partial.id, // standalone: group of one
    groupRank: partial.groupRank ?? 1,
    groupMaxWins: partial.groupMaxWins ?? 1,
    ...partial,
  };
}

describe("resolveFaabGroups", () => {
  it("with only standalone bids, matches plain per-player resolution", () => {
    const bids = [
      bid({ id: "a1", teamId: "A", bidAmount: 20, playerKey: "p1" }),
      bid({ id: "b1", teamId: "B", bidAmount: 35, playerKey: "p1" }), // wins p1
      bid({ id: "a2", teamId: "A", bidAmount: 10, playerKey: "p2" }), // wins p2 (only bid)
    ];
    const result = resolveFaabGroups(bids, standings(["A", "B"]));
    expect(result.won.sort()).toEqual(["a2", "b1"]);
    expect(result.lost).toEqual(["a1"]);
    expect(result.skipped).toEqual([]);
  });

  it("a group wins its rank-1 and skips the lower picks", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 5, playerKey: "A_player", groupId: "G", groupRank: 1 }),
      bid({ id: "g2", teamId: "A", bidAmount: 50, playerKey: "B_player", groupId: "G", groupRank: 2 }),
      bid({ id: "g3", teamId: "A", bidAmount: 10, playerKey: "C_player", groupId: "G", groupRank: 3 }),
    ];
    const result = resolveFaabGroups(bids, standings(["A"]));
    // Only the rank-1 is won even though rank-2 bid more; the rest are skipped
    // (passed over by the group condition), not lost.
    expect(result.won).toEqual(["g1"]);
    expect(result.skipped.sort()).toEqual(["g2", "g3"]);
    expect(result.lost).toEqual([]);
  });

  it("when the group's rank-1 is outbid, it wins rank-2, and rank-1 is lost (not skipped)", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 5, playerKey: "A_player", groupId: "G", groupRank: 1 }),
      bid({ id: "g2", teamId: "A", bidAmount: 50, playerKey: "B_player", groupId: "G", groupRank: 2 }),
      bid({ id: "x", teamId: "B", bidAmount: 6, playerKey: "A_player" }), // outbids rank-1
    ];
    const result = resolveFaabGroups(bids, standings(["A", "B"]));
    expect(result.won.sort()).toEqual(["g2", "x"]);
    expect(result.lost).toEqual(["g1"]); // outbid, not suppressed
    expect(result.skipped).toEqual([]);
  });

  it("frees a suppressed player to the next bidder", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 30, playerKey: "A_player", groupId: "G", groupRank: 1 }),
      bid({ id: "g2", teamId: "A", bidAmount: 25, playerKey: "B_player", groupId: "G", groupRank: 2 }),
      bid({ id: "y", teamId: "B", bidAmount: 10, playerKey: "B_player" }), // next in line for B_player
    ];
    const result = resolveFaabGroups(bids, standings(["A", "B"]));
    // A takes its rank-1; B_player is freed and goes to B.
    expect(result.won.sort()).toEqual(["g1", "y"]);
    expect(result.skipped).toEqual(["g2"]);
    expect(result.lost).toEqual([]);
  });

  it("two interacting single-win groups each get their winnable pick", () => {
    const bids = [
      bid({ id: "x1", teamId: "X", bidAmount: 10, playerKey: "A_player", groupId: "GX", groupRank: 1 }),
      bid({ id: "x2", teamId: "X", bidAmount: 10, playerKey: "B_player", groupId: "GX", groupRank: 2 }),
      bid({ id: "y1", teamId: "Y", bidAmount: 5, playerKey: "A_player", groupId: "GY", groupRank: 1 }),
    ];
    const result = resolveFaabGroups(bids, standings(["X", "Y"]));
    // X wins A (rank-1, outbids Y), so X's B bid is skipped; Y only bid on A, wins nothing.
    expect(result.won).toEqual(["x1"]);
    expect(result.skipped).toEqual(["x2"]);
    expect(result.lost).toEqual(["y1"]);
  });

  it("switches to a higher rank when it becomes winnable after suppression frees competitors", () => {
    // A's group prefers P1 but is outbid there by B. B also has a group and
    // wins something else higher, which suppresses its P1 bid, freeing P1 to A.
    const bids = [
      bid({ id: "a1", teamId: "A", bidAmount: 5, playerKey: "P1", groupId: "GA", groupRank: 1 }),
      bid({ id: "a2", teamId: "A", bidAmount: 5, playerKey: "P2", groupId: "GA", groupRank: 2 }),
      bid({ id: "b1", teamId: "B", bidAmount: 9, playerKey: "P1", groupId: "GB", groupRank: 2 }), // outbids A on P1
      bid({ id: "b2", teamId: "B", bidAmount: 9, playerKey: "P3", groupId: "GB", groupRank: 1 }), // B prefers P3
    ];
    const result = resolveFaabGroups(bids, standings(["A", "B"]));
    // B wins P3 (rank-1), suppressing b1; P1 frees to A (rank-1), so A's P2 is skipped.
    expect(result.won.sort()).toEqual(["a1", "b2"]);
    expect(result.skipped.sort()).toEqual(["a2", "b1"]);
    expect(result.lost).toEqual([]);
  });

  it("respects group_max_wins > 1 by keeping the top-ranked winnable bids", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 30, playerKey: "P1", groupId: "G", groupRank: 1, groupMaxWins: 2 }),
      bid({ id: "g2", teamId: "A", bidAmount: 20, playerKey: "P2", groupId: "G", groupRank: 2, groupMaxWins: 2 }),
      bid({ id: "g3", teamId: "A", bidAmount: 10, playerKey: "P3", groupId: "G", groupRank: 3, groupMaxWins: 2 }),
    ];
    const result = resolveFaabGroups(bids, standings(["A"]));
    expect(result.won.sort()).toEqual(["g1", "g2"]);
    expect(result.skipped).toEqual(["g3"]);
    expect(result.lost).toEqual([]);
  });

  it("a fully outbid group wins nothing and every bid is lost", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 5, playerKey: "P1", groupId: "G", groupRank: 1 }),
      bid({ id: "g2", teamId: "A", bidAmount: 5, playerKey: "P2", groupId: "G", groupRank: 2 }),
      bid({ id: "x", teamId: "B", bidAmount: 6, playerKey: "P1" }),
      bid({ id: "y", teamId: "C", bidAmount: 6, playerKey: "P2" }),
    ];
    const result = resolveFaabGroups(bids, standings(["A", "B", "C"]));
    expect(result.won.sort()).toEqual(["x", "y"]);
    expect(result.lost.sort()).toEqual(["g1", "g2"]);
    expect(result.skipped).toEqual([]);
  });
});
