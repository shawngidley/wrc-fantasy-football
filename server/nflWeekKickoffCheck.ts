/**
 * Has the first real NFL game of a given week already kicked off?
 * Used to lock the rivalry game declaration window -- once true, no owner
 * can declare a rivalry game for that week for the rest of it, regardless
 * of when their own specific matchup's games happen to kick off.
 *
 * Checks TWO independent signals and treats either as sufficient:
 *   1. Tank01's gameStatus field (one of exactly three values, confirmed
 *      elsewhere in this codebase: "Scheduled", "In Progress", "Final").
 *   2. The scheduled kickoff time (gameDate/gameTime) has actually
 *      passed, computed directly rather than trusting gameStatus alone.
 * This second check exists because gameStatus has been directly observed
 * in production still showing "Scheduled" a dozen-plus minutes after a
 * game's actual scheduled kickoff -- Tank01's own status field lagging
 * real kickoff. Relying on gameStatus alone would let the rivalry
 * declaration window stay open past the real first snap during that lag.
 */

const TANK01_BASE_URL = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";

interface Tank01Game {
  gameStatus?: string;
  gameDate?: string;
  gameTime?: string;
}

/** Same Date.UTC-based kickoff computation as the client-side
 * isGameActive/isPlayerLocked fixes -- string-interpolated ISO
 * construction doesn't handle hour overflow (8pm+ ET kickoffs) and
 * silently produces an Invalid Date instead. */
function hasKickoffTimePassed(gameDate: string | undefined, gameTime: string | undefined): boolean {
  if (!gameDate || !gameTime || gameDate.length < 8) return false;
  const year = parseInt(gameDate.slice(0, 4), 10);
  const month = parseInt(gameDate.slice(4, 6), 10) - 1; // Date.UTC months are 0-indexed
  const day = parseInt(gameDate.slice(6, 8), 10);
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;
  const offsetHours = 4; // EDT
  const kickoffUTC = new Date(Date.UTC(year, month, day, hours + offsetHours, mins, 0));
  return Date.now() >= kickoffUTC.getTime();
}

export async function hasWeekKickedOff(week: number, season: number): Promise<boolean> {
  const key = process.env.TANK01_API_KEY;
  if (!key) throw new Error("Tank01 API credential is unavailable.");
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com" };
  const response = await fetch(
    `${TANK01_BASE_URL}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Unable to load this week's NFL games (${response.status}).`);
  const games = ((await response.json()).body ?? []) as Tank01Game[];
  return games.some(game =>
    (game.gameStatus && game.gameStatus !== "Scheduled") ||
    hasKickoffTimePassed(game.gameDate, game.gameTime)
  );
}
