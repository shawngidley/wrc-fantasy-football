/**
 * The "Min left" column on the Live Scoring league scoreboard.
 *
 * The number is the same one the matchup card shows (⏱): the game minutes still
 * to be played across a team's 10 starters, 600 before any kickoff, counting
 * down to 0 as each starter's game goes final. A starter whose game is over
 * contributes 0. Two starters in the same game both count that game's time.
 */
export function formatMinutesLeft(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const rounded = Math.max(0, Math.round(minutes));
  return rounded === 0 ? "Done" : String(rounded);
}
