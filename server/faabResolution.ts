/**
 * FAAB bid resolution -- shared by the manual commissioner "Manage Bids"
 * award action and the automated Thu/Sun 9am ET award cron job, so both
 * paths apply the exact same tiebreak rule rather than risking drift
 * between two separate implementations.
 *
 * Tiebreak order when bid amounts are equal:
 *   1. Worst record wins (lowest win percentage)
 *   2. Still tied -> least points scored wins (lowest points_for)
 */

export interface FaabBidCandidate {
  id: string;
  teamId: string;
  bidAmount: number;
}

export interface TeamStandingForTiebreak {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

/** Win percentage for tiebreak comparison. A team with zero games played
 * (0-0-0) is treated as a .500 record -- not worst, not best -- since
 * there's no games-played evidence either way to call them "worse" than
 * a team that has actually lost.
 */
function winPct(standing: TeamStandingForTiebreak): number {
  const gamesPlayed = standing.wins + standing.losses + standing.ties;
  if (gamesPlayed === 0) return 0.5;
  return (standing.wins + standing.ties * 0.5) / gamesPlayed;
}

/**
 * Picks the winning bid from a list of pending bids for the same player.
 * standingsByTeamId must include an entry for every team_id present in
 * candidates -- throws if any is missing, rather than silently picking
 * an arbitrary winner on incomplete data.
 */
export function resolveFaabWinner(
  candidates: readonly FaabBidCandidate[],
  standingsByTeamId: ReadonlyMap<string, TeamStandingForTiebreak>,
): FaabBidCandidate {
  if (candidates.length === 0) throw new Error("resolveFaabWinner called with no candidates");

  const missing = candidates.find(c => !standingsByTeamId.has(c.teamId));
  if (missing) throw new Error(`Missing team standing for tiebreak: team ${missing.teamId}`);

  const sorted = [...candidates].sort((a, b) => {
    if (b.bidAmount !== a.bidAmount) return b.bidAmount - a.bidAmount; // highest bid first
    const standingA = standingsByTeamId.get(a.teamId)!;
    const standingB = standingsByTeamId.get(b.teamId)!;
    const pctA = winPct(standingA);
    const pctB = winPct(standingB);
    if (pctA !== pctB) return pctA - pctB; // worst record (lowest pct) first
    if (standingA.pointsFor !== standingB.pointsFor) return standingA.pointsFor - standingB.pointsFor; // least points scored first
    // Final deterministic fallback for the rare case both real tiebreakers
    // are identical too -- most notably the very first award run (Sept 13,
    // before any Week 1 games have been scored), where every team starts
    // 0-0-0 with 0 points and neither tiebreaker above can distinguish
    // them. Ensures the sort is always fully deterministic rather than
    // depending on whatever order the bids happened to be fetched in.
    return a.teamId.localeCompare(b.teamId);
  });

  return sorted[0];
}
