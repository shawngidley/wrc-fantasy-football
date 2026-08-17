/**
 * Exact WRC 2025 regular-season kicker totals, derived from nflverse play-by-play.
 * Tank01 season records expose FGM/FGA/XPM/XPA but not completed kick distances,
 * which prevents exact fractional field-goal scoring from those aggregates alone.
 */
export interface CompletedKickerSeasonStats {
  games: number;
  fgm: number;
  fga: number;
  xpm: number;
  xpa: number;
  wrcPts: number;
}

const line = (games: number, fgm: number, fga: number, xpm: number, xpa: number, wrcPts: number): CompletedKickerSeasonStats => ({ games, fgm, fga, xpm, xpa, wrcPts });

const KICKER_SEASON_STATS_2025: Record<string, CompletedKickerSeasonStats> = {
  "brandon aubrey": line(17, 36, 42, 47, 48, 195.4),
  "cairo santos": line(15, 25, 30, 39, 39, 132.8),
  "cam little": line(17, 30, 34, 50, 51, 172.9),
  "cameron dicker": line(17, 38, 41, 34, 35, 174.5),
  "chase mclaughlin": line(17, 32, 38, 32, 33, 156.6),
  "chris boswell": line(17, 27, 32, 42, 43, 151.7),
  "eddy pineiro": line(14, 28, 29, 34, 38, 140.5),
  "evan mcpherson": line(17, 25, 28, 41, 44, 137.8),
  "jake bates": line(17, 27, 34, 54, 56, 152.6),
  "jake elliott": line(17, 20, 27, 41, 42, 115.2),
  "jason myers": line(17, 41, 48, 48, 48, 206.6),
  "joey slye": line(16, 28, 35, 26, 27, 137.2),
  "joshua karty": line(8, 10, 15, 23, 26, 45.3),
  "ka'imi fairbairn": line(15, 44, 48, 28, 28, 203.3),
  "tyler loop": line(17, 30, 34, 44, 46, 140.7),
  "will reichard": line(17, 33, 35, 31, 31, 168.9),
  "andy borregales": line(17, 27, 32, 53, 55, 135.8),
};

const KICKER_ALIASES: Record<string, string> = {
  "andres borregales": "andy borregales",
};

export function getCompletedKickerSeasonStats(name: string): CompletedKickerSeasonStats | undefined {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  return KICKER_SEASON_STATS_2025[KICKER_ALIASES[key] ?? key];
}
