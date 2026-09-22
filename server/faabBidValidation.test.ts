import { describe, expect, it } from "vitest";
import { committedFaab, findSharedDropConflict, type BudgetBid, type DropCheckBid } from "./faabBidValidation";

function bBid(p: Partial<BudgetBid> & Pick<BudgetBid, "bidAmount">): BudgetBid {
  return { groupId: null, groupMaxWins: null, ...p };
}

describe("committedFaab", () => {
  it("standalone bids commit their full amount (matches the old flat sum)", () => {
    const bids = [bBid({ bidAmount: 20 }), bBid({ bidAmount: 35 }), bBid({ bidAmount: 10 })];
    expect(committedFaab(bids)).toBe(65);
  });

  it("a win-one group commits only its single largest bid", () => {
    const bids = [
      bBid({ bidAmount: 5, groupId: "G", groupMaxWins: 1 }),
      bBid({ bidAmount: 50, groupId: "G", groupMaxWins: 1 }),
      bBid({ bidAmount: 10, groupId: "G", groupMaxWins: 1 }),
    ];
    expect(committedFaab(bids)).toBe(50);
  });

  it("a win-up-to-N group commits the sum of its top N bids", () => {
    const bids = [
      bBid({ bidAmount: 40, groupId: "G", groupMaxWins: 2 }),
      bBid({ bidAmount: 20, groupId: "G", groupMaxWins: 2 }),
      bBid({ bidAmount: 5, groupId: "G", groupMaxWins: 2 }),
    ];
    expect(committedFaab(bids)).toBe(60); // 40 + 20, not 65
  });

  it("mixes standalone bids and groups", () => {
    const bids = [
      bBid({ bidAmount: 20 }), // standalone
      bBid({ bidAmount: 50, groupId: "G", groupMaxWins: 1 }),
      bBid({ bidAmount: 30, groupId: "G", groupMaxWins: 1 }),
      bBid({ bidAmount: 40, groupId: "H", groupMaxWins: 2 }),
      bBid({ bidAmount: 20, groupId: "H", groupMaxWins: 2 }),
      bBid({ bidAmount: 5, groupId: "H", groupMaxWins: 2 }),
    ];
    // 20 (standalone) + 50 (G top-1) + 60 (H top-2) = 130
    expect(committedFaab(bids)).toBe(130);
  });

  it("treats a null max_wins as 1", () => {
    const bids = [
      bBid({ bidAmount: 30, groupId: "G", groupMaxWins: null }),
      bBid({ bidAmount: 10, groupId: "G", groupMaxWins: null }),
    ];
    expect(committedFaab(bids)).toBe(30);
  });

  it("is empty-safe and never negative", () => {
    expect(committedFaab([])).toBe(0);
    expect(committedFaab([bBid({ bidAmount: -5 })])).toBe(0);
  });
});

function dBid(p: Partial<DropCheckBid> & Pick<DropCheckBid, "id">): DropCheckBid {
  return { dropPlayerId: null, groupId: null, groupMaxWins: null, ...p };
}

describe("findSharedDropConflict", () => {
  it("allows a drop no other pending bid uses", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "otherGuy" })];
    const result = findSharedDropConflict({ dropPlayerId: "myDrop", groupId: null, groupMaxWins: 1 }, existing);
    expect(result).toBeNull();
  });

  it("blocks a standalone bid from sharing a drop with an existing bid", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "D" })];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: null, groupMaxWins: 1 }, existing);
    expect(result?.id).toBe("a");
  });

  it("allows sharing a drop inside the same win-one group", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "D", groupId: "G", groupMaxWins: 1 })];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: "G", groupMaxWins: 1 }, existing);
    expect(result).toBeNull();
  });

  it("blocks sharing a drop across two different groups", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "D", groupId: "G1", groupMaxWins: 1 })];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: "G2", groupMaxWins: 1 }, existing);
    expect(result?.id).toBe("a");
  });

  it("blocks sharing a drop inside an N>1 group (each win needs its own drop)", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "D", groupId: "G", groupMaxWins: 2 })];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: "G", groupMaxWins: 2 }, existing);
    expect(result?.id).toBe("a");
  });

  it("blocks a win-one group bid from sharing with a standalone bid on the same drop", () => {
    const existing = [dBid({ id: "a", dropPlayerId: "D", groupId: null })];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: "G", groupMaxWins: 1 }, existing);
    expect(result?.id).toBe("a");
  });

  it("returns the offending bid when several pending bids share the drop but one is out-of-group", () => {
    const existing = [
      dBid({ id: "ok", dropPlayerId: "D", groupId: "G", groupMaxWins: 1 }),
      dBid({ id: "bad", dropPlayerId: "D", groupId: "OTHER", groupMaxWins: 1 }),
    ];
    const result = findSharedDropConflict({ dropPlayerId: "D", groupId: "G", groupMaxWins: 1 }, existing);
    expect(result?.id).toBe("bad");
  });
});
