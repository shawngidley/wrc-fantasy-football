/**
 * Pure submission-time validation for FAAB bids, split out so the two rules
 * conditional bidding changes -- the budget commitment and the shared-drop
 * rule -- are unit-testable without a database, like resolveFaabWinner and
 * resolveFaabGroups. The router loads the team's pending bids, calls these,
 * and turns a non-null/over-budget result into a user-facing error.
 *
 * Both functions treat a standalone bid (groupId === null) as a group of one
 * with max_wins 1, so ungrouped behavior is identical to the old flat rules.
 */

export interface BudgetBid {
  bidAmount: number;
  /** Group id, or null for a standalone bid (commits its full amount). */
  groupId: string | null;
  /** How many of the group may be won; null/absent means 1. */
  groupMaxWins: number | null;
}

/**
 * FAAB a set of pending bids actually commits. A standalone bid commits its
 * full amount. A group can only ever win its top `group_max_wins` picks, so it
 * commits the sum of its `max_wins` LARGEST bid amounts -- which is exactly
 * what lets an owner bid $50 on three players in one win-one group while only
 * tying up $50. Total committed must stay <= the team's FAAB balance.
 */
export function committedFaab(bids: readonly BudgetBid[]): number {
  let total = 0;
  const groupAmounts = new Map<string, number[]>();
  const groupMaxWins = new Map<string, number>();

  for (const bid of bids) {
    const amount = Math.max(0, Number(bid.bidAmount) || 0);
    if (bid.groupId == null) {
      total += amount; // standalone: commits its full amount
      continue;
    }
    const amounts = groupAmounts.get(bid.groupId) ?? [];
    amounts.push(amount);
    groupAmounts.set(bid.groupId, amounts);
    // All bids in a group carry the same max_wins; take the max seen so a
    // stray-low value can never under-count what the group commits.
    const seen = Math.max(1, Math.trunc(Number(bid.groupMaxWins)) || 1);
    const prev = groupMaxWins.get(bid.groupId);
    groupMaxWins.set(bid.groupId, prev == null ? seen : Math.max(prev, seen));
  }

  for (const [groupId, amounts] of Array.from(groupAmounts.entries())) {
    const max = groupMaxWins.get(groupId) ?? 1;
    const topN = [...amounts].sort((a, b) => b - a).slice(0, max);
    total += topN.reduce((sum, amount) => sum + amount, 0);
  }
  return total;
}

export interface DropCheckBid {
  id: string;
  /** Pledged drop player id, or null if the bid names no drop. */
  dropPlayerId: string | null;
  groupId: string | null;
  groupMaxWins: number | null;
}

/**
 * A roster spot can only be vacated once, so a drop player may back more than
 * one pending bid ONLY when those bids are all in the same win-one group (at
 * most one wins, so the shared drop is safe -- and ranking three RBs behind a
 * single drop is the whole point). Sharing is disallowed for a standalone bid,
 * across different groups, and inside an N>1 group (up to N win at once, each
 * needing its own distinct drop).
 *
 * Returns an existing pending bid that conflicts with the new bid's drop, or
 * null when the shared drop is allowed. The new bid is not yet persisted, so
 * it is passed in separately from the existing pending set.
 */
export function findSharedDropConflict(
  newBid: { dropPlayerId: string; groupId: string | null; groupMaxWins: number | null },
  existingPending: readonly DropCheckBid[],
): DropCheckBid | null {
  const pledgingSameDrop = existingPending.filter(
    bid => bid.dropPlayerId != null && bid.dropPlayerId === newBid.dropPlayerId,
  );
  if (pledgingSameDrop.length === 0) return null;

  const newInWinOneGroup = newBid.groupId != null && (newBid.groupMaxWins ?? 1) === 1;
  // A standalone bid or an N>1 group can never share a drop with anything.
  if (!newInWinOneGroup) return pledgingSameDrop[0];

  // Sharing is allowed only with bids in this very same win-one group.
  const conflict = pledgingSameDrop.find(
    bid => bid.groupId !== newBid.groupId || (bid.groupMaxWins ?? 1) !== 1,
  );
  return conflict ?? null;
}
