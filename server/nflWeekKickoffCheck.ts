/**
 * Has the first real NFL game of a given week already kicked off?
 * Used to lock the rivalry game declaration window -- once true, no owner
 * can declare a rivalry game for that week for the rest of it, regardless
 * of when their own specific matchup's games happen to kick off.
 *
 * Tank01's gameStatus field is one of exactly three values (confirmed
 * elsewhere in this codebase, e.g. useNFLTeamSchedule.ts): "Scheduled",
 * "In Progress", or "Final". Any game showing something other than
 * "Scheduled" means it has already started.
 */

const TANK01_BASE_URL = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";

export async function hasWeekKickedOff(week: number, season: number): Promise<boolean> {
  const key = process.env.TANK01_API_KEY;
  if (!key) throw new Error("Tank01 API credential is unavailable.");
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com" };
  const response = await fetch(
    `${TANK01_BASE_URL}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Unable to load this week's NFL games (${response.status}).`);
  const games = ((await response.json()).body ?? []) as Array<{ gameStatus?: string }>;
  return games.some(game => game.gameStatus && game.gameStatus !== "Scheduled");
}
