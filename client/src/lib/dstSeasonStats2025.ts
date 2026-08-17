/**
 * Reconciled 2025 regular-season D/ST totals.
 *
 * Sacks, safeties, and return touchdowns are derived from nflverse 2025 play-by-play.
 * Takeaways, defensive interceptions, opponent fumbles lost, and points allowed are
 * reconciled to the completed 2025 Pro Football Reference team-defense table.
 * Do not replace fumblesRecovered with Tank01 teamStats.Defense.fumblesRecovered:
 * that field also includes a team's recovery of its own offensive fumbles.
 */
export interface CompletedDstSeasonStats {
  games: number;
  sacks: number;
  safeties: number;
  takeaways: number;
  defInt: number;
  fumblesRecovered: number;
  dstTD: number;
  ptsAgainst: number;
}

type DstStatLine = Omit<CompletedDstSeasonStats, "games">;

const line = (sacks: number, safeties: number, takeaways: number, defInt: number, fumblesRecovered: number, dstTD: number, ptsAgainst: number): DstStatLine => ({
  sacks, safeties, takeaways, defInt, fumblesRecovered, dstTD, ptsAgainst,
});

export const DST_SEASON_STATS_2025: Record<string, CompletedDstSeasonStats> = Object.fromEntries(
  Object.entries({
    ARI: line(30, 1, 19, 10, 9, 2, 488), ATL: line(57, 0, 23, 16, 7, 1, 401),
    BAL: line(30, 0, 20, 11, 9, 2, 398), BUF: line(36, 0, 20, 13, 7, 3, 365),
    CAR: line(30, 0, 21, 15, 6, 2, 380), CHI: line(35, 0, 33, 23, 10, 2, 415),
    CIN: line(35, 0, 21, 13, 8, 2, 492), CLE: line(53, 0, 18, 11, 7, 4, 379),
    DAL: line(35, 1, 12, 6, 6, 1, 511), DEN: line(68, 0, 14, 10, 4, 2, 311),
    DET: line(49, 1, 19, 13, 6, 1, 413), GB: line(36, 0, 14, 7, 7, 0, 360),
    HOU: line(47, 0, 29, 19, 10, 4, 295), IND: line(39, 0, 21, 14, 7, 1, 412),
    JAC: line(32, 1, 31, 22, 9, 4, 336), KC: line(35, 0, 14, 10, 4, 0, 328),
    LAR: line(47, 0, 26, 16, 10, 1, 346), LAC: line(45, 1, 23, 19, 4, 0, 340),
    LV: line(37, 1, 16, 8, 8, 0, 432), MIA: line(39, 0, 20, 9, 11, 1, 424),
    MIN: line(49, 0, 21, 8, 13, 2, 333), NE: line(35, 1, 19, 10, 9, 5, 320),
    NO: line(45, 0, 20, 10, 10, 3, 383), NYG: line(39, 0, 15, 9, 6, 2, 439),
    NYJ: line(26, 1, 4, 0, 4, 3, 503), PHI: line(42, 0, 21, 12, 9, 1, 325),
    PIT: line(48, 1, 27, 15, 12, 3, 387), SEA: line(47, 0, 25, 18, 7, 6, 292),
    SF: line(20, 0, 16, 6, 10, 1, 371), TB: line(37, 1, 23, 13, 10, 2, 411),
    TEN: line(42, 1, 14, 6, 8, 4, 478), WSH: line(42, 1, 10, 8, 2, 2, 451),
  }).map(([team, stats]) => [team, { games: 17, ...stats }]),
);
