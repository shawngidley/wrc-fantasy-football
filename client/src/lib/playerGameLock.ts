import type { NFLMatchupMap } from "@/hooks/useNFLMatchups";
import { normalizeNFLTeamCode as normalizeNFLTeam } from "@shared/nflTeamCodes";
import { hasEasternKickoffPassed } from "@shared/nflKickoffTime";

/**
 * Returns true if the given NFL team's game this week has already kicked
 * off. A team on a bye (no game this week) is never considered "started" --
 * there's no outcome to have locked in.
 *
 * Extracted from Lineup.tsx's isPlayerLocked so this same logic can be
 * reused elsewhere (e.g. locking a player's Free Agents bid tag once
 * their game starts) without duplicating it a second time.
 */
export function hasTeamGameStarted(nflTeam: string, matchupMap: NFLMatchupMap): boolean {
  const normTeam = normalizeNFLTeam(nflTeam);
  const matchup = matchupMap[normTeam];
  if (!matchup) return false; // no game this week → not started (bye)
  const { gameDate, gameTime } = matchup;
  if (!gameDate || !gameTime) return false;

  // Eastern kickoff with the real offset for that date (EDT before Nov 1, EST
  // after), see shared/nflKickoffTime.ts.
  return hasEasternKickoffPassed(gameDate, gameTime);
}
