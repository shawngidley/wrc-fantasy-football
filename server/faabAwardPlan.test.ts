import { describe, expect, it } from "vitest";
import { planFaabAwards, type PlannerBid } from "./faabAwardPlan";
import { type TeamStandingForTiebreak } from "./faabResolution";

function standings(teamIds: string[]): Map<string, TeamStandingForTiebreak> {
  return new Map(teamIds.map(id => [id, { wins: 5, losses: 5, ties: 0, pointsFor: 800 }]));
}

function bid(p: Partial<PlannerBid> & Pick<PlannerBid, "id" | "teamId" | "bidAmount" | "playerKey">): PlannerBid {
  return {
    groupId: null,
    groupRank: null,
    groupMaxWins: null,
    playerAlreadyRostered: false,
    dropStillOnTeam: true, // by default a valid drop, so bids are fillable
    ...p,
  };
}

const alwaysOpen = () => true;
const neverOpen = () => false;

describe("planFaabAwards", () => {
  it("standalone bids resolve exactly like the per-player winner", () => {
    const bids = [
      bid({ id: "a", teamId: "A", bidAmount: 20, playerKey: "p1" }),
      bid({ id: "b", teamId: "B", bidAmount: 35, playerKey: "p1" }),
      bid({ id: "c", teamId: "A", bidAmount: 10, playerKey: "p2" }),
    ];
    const plan = planFaabAwards(bids, standings(["A", "B"]), alwaysOpen);
    expect(plan.award.sort()).toEqual(["b", "c"]);
    expect(plan.lost).toEqual(["a"]);
    expect(plan.skipped).toEqual([]);
    expect(plan.cancelled).toEqual([]);
  });

  it("cancels a bid on a player already on a roster", () => {
    const bids = [
      bid({ id: "a", teamId: "A", bidAmount: 20, playerKey: "p1", playerAlreadyRostered: true }),
      bid({ id: "b", teamId: "B", bidAmount: 35, playerKey: "p1", playerAlreadyRostered: true }),
    ];
    const plan = planFaabAwards(bids, standings(["A", "B"]), alwaysOpen);
    expect(plan.award).toEqual([]);
    expect(plan.cancelled).toEqual([
      { id: "a", reason: "already-rostered" },
      { id: "b", reason: "already-rostered" },
    ]);
  });

  it("cancels an unfillable bid (drop gone, roster full) and lets the next bid win", () => {
    const bids = [
      bid({ id: "top", teamId: "A", bidAmount: 50, playerKey: "p1", dropStillOnTeam: false }), // unfillable
      bid({ id: "next", teamId: "B", bidAmount: 10, playerKey: "p1", dropStillOnTeam: true }),
    ];
    // Team A has no open spot, so its dropless-and-drop-gone bid can't be filled.
    const plan = planFaabAwards(bids, standings(["A", "B"]), (t) => t !== "A");
    expect(plan.cancelled).toEqual([{ id: "top", reason: "unfillable" }]);
    expect(plan.award).toEqual(["next"]); // freed to the next bidder
    expect(plan.lost).toEqual([]);
  });

  it("a dropless bid is still fillable when the team has an open spot", () => {
    const bids = [bid({ id: "a", teamId: "A", bidAmount: 5, playerKey: "p1", dropStillOnTeam: false })];
    const plan = planFaabAwards(bids, standings(["A"]), alwaysOpen);
    expect(plan.award).toEqual(["a"]);
    expect(plan.cancelled).toEqual([]);
  });

  it("a dropless bid with a full roster is cancelled as unfillable", () => {
    const bids = [bid({ id: "a", teamId: "A", bidAmount: 5, playerKey: "p1", dropStillOnTeam: false })];
    const plan = planFaabAwards(bids, standings(["A"]), neverOpen);
    expect(plan.award).toEqual([]);
    expect(plan.cancelled).toEqual([{ id: "a", reason: "unfillable" }]);
  });

  it("a ranked group wins its rank-1 and skips the rest", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 5, playerKey: "P1", groupId: "G", groupRank: 1, groupMaxWins: 1 }),
      bid({ id: "g2", teamId: "A", bidAmount: 50, playerKey: "P2", groupId: "G", groupRank: 2, groupMaxWins: 1 }),
    ];
    const plan = planFaabAwards(bids, standings(["A"]), alwaysOpen);
    expect(plan.award).toEqual(["g1"]);
    expect(plan.skipped).toEqual(["g2"]);
    expect(plan.lost).toEqual([]);
    expect(plan.cancelled).toEqual([]);
  });

  it("win-up-to-N keeps the top-N of the group", () => {
    const bids = [
      bid({ id: "g1", teamId: "A", bidAmount: 30, playerKey: "P1", groupId: "G", groupRank: 1, groupMaxWins: 2 }),
      bid({ id: "g2", teamId: "A", bidAmount: 20, playerKey: "P2", groupId: "G", groupRank: 2, groupMaxWins: 2 }),
      bid({ id: "g3", teamId: "A", bidAmount: 10, playerKey: "P3", groupId: "G", groupRank: 3, groupMaxWins: 2 }),
    ];
    const plan = planFaabAwards(bids, standings(["A"]), alwaysOpen);
    expect(plan.award.sort()).toEqual(["g1", "g2"]);
    expect(plan.skipped).toEqual(["g3"]);
  });
});
