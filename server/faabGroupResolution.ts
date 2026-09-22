/**
 * Conditional (ranked-group) FAAB resolution.
 *
 * Layers group constraints on top of the per-player winner primitive
 * (resolveFaabWinner). A "group" is all bids sharing a groupId; a standalone
 * bid is a group of one. A group wins at most groupMaxWins players (v1: 1),
 * taking the highest-RANKED ones it can actually win.
 *
 * Why a fixpoint and not a single pass: a team winning its rank-1 must give
 * up its lower-ranked bids, which frees those players for the next bidder,
 * which can change other teams' outcomes, which can change this team's, and
 * so on. The loop below only ever DEACTIVATES a bid that is currently
 * winning and is excess (beyond its group's top-max by rank). It never
 * touches a non-winning bid, so a higher-ranked bid that is momentarily
 * outbid stays alive and can still win if a competitor later drops out.
 * Deactivation is monotonic (active only shrinks) and "winnable" only grows
 * as competitors leave, so the loop converges in at most O(bids) rounds.
 *
 * Pure and standings-driven -- no DB, no side effects -- so it is unit
 * tested in isolation and shared by both the cron award and the manual
 * commissioner award, exactly like resolveFaabWinner.
 */
import { resolveFaabWinner, type FaabBidCandidate, type TeamStandingForTiebreak } from "./faabResolution";

export interface GroupedFaabBid extends FaabBidCandidate {
  /** Normalized player key. Bids sharing it compete for the same player. */
  playerKey: string;
  /** Group id. Standalone bids must be given a unique id (e.g. the bid id). */
  groupId: string;
  /** 1-based preference within the group; lower rank is tried first. */
  groupRank: number;
  /** How many of the group may be won. Coerced to >= 1. */
  groupMaxWins: number;
}

export interface FaabGroupResolution {
  /** Awarded bid ids: at most one per player, at most maxWins per group. */
  won: string[];
  /** Bids beaten head-to-head on their player (outbid). */
  lost: string[];
  /** Bids passed over because their group already reached maxWins. */
  skipped: string[];
}

export function resolveFaabGroups(
  bids: readonly GroupedFaabBid[],
  standingsByTeamId: ReadonlyMap<string, TeamStandingForTiebreak>,
): FaabGroupResolution {
  const byId = new Map(bids.map(bid => [bid.id, bid]));
  const active = new Set(bids.map(bid => bid.id));
  const skipped = new Set<string>();

  // All bids in a group carry the same maxWins; take the min defensively in
  // case of inconsistent input, and never below 1.
  const groupMaxWins = new Map<string, number>();
  for (const bid of bids) {
    const value = Math.max(1, Math.trunc(bid.groupMaxWins) || 1);
    const prev = groupMaxWins.get(bid.groupId);
    groupMaxWins.set(bid.groupId, prev == null ? value : Math.min(prev, value));
  }

  // playerKey -> winning bid id, among currently active bids.
  const currentWinners = (): Map<string, string> => {
    const byPlayer = new Map<string, GroupedFaabBid[]>();
    for (const id of Array.from(active)) {
      const bid = byId.get(id)!;
      const list = byPlayer.get(bid.playerKey) ?? [];
      list.push(bid);
      byPlayer.set(bid.playerKey, list);
    }
    const winners = new Map<string, string>();
    for (const [playerKey, list] of Array.from(byPlayer.entries())) {
      const winner = resolveFaabWinner(
        list.map(bid => ({ id: bid.id, teamId: bid.teamId, bidAmount: bid.bidAmount })),
        standingsByTeamId,
      );
      winners.set(playerKey, winner.id);
    }
    return winners;
  };

  for (;;) {
    const winnerIds = Array.from(currentWinners().values());
    const groupWins = new Map<string, GroupedFaabBid[]>();
    for (const id of winnerIds) {
      const bid = byId.get(id)!;
      const list = groupWins.get(bid.groupId) ?? [];
      list.push(bid);
      groupWins.set(bid.groupId, list);
    }

    let changed = false;
    for (const [groupId, wins] of Array.from(groupWins.entries())) {
      const max = groupMaxWins.get(groupId) ?? 1;
      if (wins.length > max) {
        // Keep the top-max by rank; give up the lowest-ranked excess wins so
        // their players flow to the next bidder next round.
        const excess = [...wins].sort((a, b) => a.groupRank - b.groupRank).slice(max);
        for (const bid of excess) {
          active.delete(bid.id);
          skipped.add(bid.id);
        }
        changed = true;
      }
    }
    if (!changed) break;
  }

  const finalWon = new Set(Array.from(currentWinners().values()));
  const won: string[] = [];
  const lost: string[] = [];
  const skippedOut: string[] = [];
  for (const bid of bids) {
    if (finalWon.has(bid.id)) won.push(bid.id);
    else if (skipped.has(bid.id)) skippedOut.push(bid.id);
    else lost.push(bid.id);
  }
  return { won, lost, skipped: skippedOut };
}
