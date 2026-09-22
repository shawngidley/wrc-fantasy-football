/**
 * Pure planning step for a FAAB award run. Turns the pending bids plus the
 * current roster picture into a flat set of decisions -- which bids to
 * award, which are outbid (lost), which the group passed over (skipped),
 * and which are unawardable and get cancelled -- WITHOUT touching the
 * database. The award endpoints (the Thu/Sun cron and the commissioner
 * manual award) load the data, call this, then just execute the plan.
 *
 * Separating the decision from the writes is deliberate: the decision is
 * where all the conditional-group logic lives, and it is the part worth
 * unit testing exhaustively (the writes are mechanical and already covered
 * by the existing per-winner code). Mirrors how resolveFaabWinner and
 * resolveFaabGroups are pure and tested in isolation.
 *
 * Fillability (open roster spot) uses the start-of-run roster counts, the
 * same basis the previous per-player awardable check used. A team winning
 * several no-drop bids at once (only reachable with multiple groups or a
 * win-up-to-N group) is bounded by submission-time validation, with the
 * executor's per-winner roster check as a backstop.
 */
import { resolveFaabGroups, type GroupedFaabBid } from "./faabGroupResolution";
import { type TeamStandingForTiebreak } from "./faabResolution";

export interface PlannerBid {
  id: string;
  teamId: string;
  /** Normalized player name; bids sharing it compete for the same player. */
  playerKey: string;
  bidAmount: number;
  /** Group id, or null for a standalone bid (a group of one). */
  groupId: string | null;
  /** 1-based preference within the group; null for standalone. */
  groupRank: number | null;
  /** How many of the group may be won; null/absent means 1. */
  groupMaxWins: number | null;
  /** This player is already on some WRC roster, so not a free agent. */
  playerAlreadyRostered: boolean;
  /** The pledged drop player is still on this bid's own roster. */
  dropStillOnTeam: boolean;
}

export type CancelReason = "already-rostered" | "unfillable";

export interface FaabAwardPlan {
  /** Winning bid ids: at most one per player, at most maxWins per group. */
  award: string[];
  /** Bids beaten head-to-head on their player. */
  lost: string[];
  /** Bids the group passed over because it already won a higher pick. */
  skipped: string[];
  /** Bids that could not be awarded at all, with why. */
  cancelled: { id: string; reason: CancelReason }[];
}

export function planFaabAwards(
  bids: readonly PlannerBid[],
  standingsByTeamId: ReadonlyMap<string, TeamStandingForTiebreak>,
  hasOpenSpot: (teamId: string) => boolean,
): FaabAwardPlan {
  const cancelled: { id: string; reason: CancelReason }[] = [];
  const contenders: GroupedFaabBid[] = [];

  for (const bid of bids) {
    // A player already on any roster is not a free agent -- no bid on them
    // is awardable. (Backstop for the submission-time guard.)
    if (bid.playerAlreadyRostered) {
      cancelled.push({ id: bid.id, reason: "already-rostered" });
      continue;
    }
    // Unawardable if the pledged drop is gone AND there is no open spot:
    // there is nothing to make room, and silently adding would overfill.
    // Filtered out BEFORE resolution so the next-best bid wins the player.
    if (!bid.dropStillOnTeam && !hasOpenSpot(bid.teamId)) {
      cancelled.push({ id: bid.id, reason: "unfillable" });
      continue;
    }
    contenders.push({
      id: bid.id,
      teamId: bid.teamId,
      bidAmount: bid.bidAmount,
      playerKey: bid.playerKey,
      groupId: bid.groupId ?? bid.id, // standalone -> its own single-bid group
      groupRank: bid.groupRank ?? 1,
      groupMaxWins: bid.groupMaxWins ?? 1,
    });
  }

  const resolution = resolveFaabGroups(contenders, standingsByTeamId);
  return { award: resolution.won, lost: resolution.lost, skipped: resolution.skipped, cancelled };
}
