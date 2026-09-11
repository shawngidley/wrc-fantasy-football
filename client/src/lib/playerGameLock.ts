import type { NFLMatchupMap } from "@/hooks/useNFLMatchups";
import { normalizeNFLTeamCode as normalizeNFLTeam } from "@shared/nflTeamCodes";

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

  // Parse gameDate: "20260913" → year/month/day components
  const d = gameDate;
  const year = parseInt(d.slice(0,4), 10);
  const month = parseInt(d.slice(4,6), 10) - 1; // Date.UTC months are 0-indexed
  const day = parseInt(d.slice(6,8), 10);

  // Parse gameTime: "1:00p" or "8:20p" (Eastern)
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;

  // Build the kickoff instant in ET (UTC-4 during EDT, UTC-5 during EST)
  // September games are EDT (UTC-4)
  const offsetHours = 4; // EDT
  // Date.UTC correctly rolls hour overflow into the next day (e.g. an
  // 8:20pm ET kickoff -> 20+4=24 -> the next day at 00:20 UTC) --
  // constructing this same value as an ISO string ("...T24:20:00Z")
  // does NOT handle that overflow and silently produces an Invalid
  // Date instead.
  const kickoffUTC = new Date(Date.UTC(year, month, day, hours + offsetHours, mins, 0));

  return Date.now() >= kickoffUTC.getTime();
}
