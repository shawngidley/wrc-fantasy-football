import { calcFantasyPoints, type Tank01Stats } from "./scoringEngine";

export interface Tank01TeamSeasonStats {
  teamAbv: string;
  wins?: string | number;
  loss?: string | number;
  tie?: string | number;
  pa?: string | number;
  teamStats?: Tank01Stats;
}

export interface PlayerSeasonStats {
  gp: number;
  passCmp: number;
  passAtt: number;
  passYds: number;
  passTD: number;
  passInt: number;
  passRating: number;
  rushAtt: number;
  rushYds: number;
  rushTD: number;
  receptions: number;
  targets: number;
  recYds: number;
  recTD: number;
  fgMade: number;
  fgAtt: number;
  fgYds: number;
  fgMade1To39: number;
  fgMade40To49: number;
  fgMade50To59: number;
  fgMade60Plus: number;
  xpMade: number;
  xpAtt: number;
  sacks: number;
  defInt: number;
  fumblesRecovered: number;
  takeaways: number;
  defTD: number;
  dstTD: number;
  returnTD: number;
  safeties: number;
  blockKicks: number;
  ptsAgainst: number;
  fumblesLost: number;
  wrcPts: number;
  ptsPerGame: number;
}

const num = (value: string | number | undefined): number => {
  const result = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(result) ? result : 0;
};

/**
 * Converts a raw Tank01 stats object into the shared PlayerSeasonStats
 * shape. Works identically whether `stats` represents a season-level
 * aggregate (from getNFLPlayerInfo) or a single game's box score (from
 * getNFLBoxScore) -- the underlying field names and structure are the
 * same either way, which is what makes this usable both for the
 * client's live display and for the server to persist a single week's
 * stat line per player.
 */
export function normalizeTankSeasonStats(stats: Tank01Stats | undefined, pos: string): PlayerSeasonStats {
  const passing = stats?.Passing ?? {};
  const rushing = stats?.Rushing ?? {};
  const receiving = stats?.Receiving ?? {};
  const kicking = stats?.Kicking ?? {};
  const kickingField = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = kicking[key];
      if (value !== undefined && value !== null && String(value) !== "") return num(value);
    }
    return undefined;
  };
  const defense = stats?.Defense ?? {};
  const defInt = num(defense.defensiveInterceptions);
  const fumblesRecovered = num(defense.fumblesRecovered);
  const defTD = num(defense.defTD);
  const returnTD = num(defense.returnTD);
  const gp = num(stats?.gamesPlayed);
  const wrcPts = stats ? calcFantasyPoints(stats, pos) : 0;

  return {
    gp,
    passCmp: num(passing.passCompletions),
    passAtt: num(passing.passAttempts),
    passYds: num(passing.passYds),
    passTD: num(passing.passTD),
    passInt: num(passing.int),
    passRating: num(passing.rtg),
    rushAtt: num(rushing.carries),
    rushYds: num(rushing.rushYds),
    rushTD: num(rushing.rushTD),
    receptions: num(receiving.receptions),
    targets: num(receiving.targets),
    recYds: num(receiving.recYds),
    recTD: num(receiving.recTD),
    fgMade: num(kicking.fgMade),
    fgAtt: num(kicking.fgAttempts),
    fgYds: num(kicking.fgYds),
    fgMade1To39: kickingField("fgMade1To39", "fgMade1_39", "fgMadeUnder40") ?? 0,
    fgMade40To49: kickingField("fgMade40To49", "fgMade40_49") ?? 0,
    fgMade50To59: kickingField("fgMade50To59", "fgMade50_59") ?? 0,
    fgMade60Plus: kickingField("fgMade60Plus", "fgMade60_99", "fgMade60OrMore") ?? 0,
    xpMade: num(kicking.xpMade),
    xpAtt: num(kicking.xpAttempts),
    sacks: num(defense.sacks),
    defInt,
    fumblesRecovered,
    takeaways: defInt + fumblesRecovered,
    defTD,
    dstTD: num(defense.defensiveOrSpecialTeamsTds) || defTD + returnTD,
    returnTD,
    safeties: num(defense.safeties),
    blockKicks: num(defense.blockKick),
    ptsAgainst: num(defense.ptsAgainst),
    fumblesLost: num(defense.fumblesLost),
    wrcPts,
    ptsPerGame: gp > 0 ? Math.round((wrcPts / gp) * 10) / 10 : 0,
  };
}

/**
 * Tank01 exposes D/ST totals from getNFLTeams?teamStats=true rather than the
 * player-info endpoint. This converts that team response to the shared
 * stat shape.
 */
export function normalizeTankTeamSeasonStats(team: Tank01TeamSeasonStats): PlayerSeasonStats {
  const defense = team.teamStats?.Defense ?? {};
  const sacks = num(defense.sacks);
  const defInt = num(defense.defensiveInterceptions);
  const fumblesRecovered = num(defense.fumblesRecovered);
  const defTD = num(defense.defTD);
  const safeties = num(defense.safeties);
  const returnTD = num(defense.returnTD);
  const blockKicks = num(defense.blockKick);
  const recordedGames = num(team.wins) + num(team.loss) + num(team.tie);
  const hasCompletedSeasonTotals = [sacks, defInt, fumblesRecovered, defTD, safeties, returnTD, blockKicks].some(value => value > 0);
  // Before a new season begins Tank01 can retain the completed team totals while
  // resetting the current standings record. Every NFL team played 17 games in
  // that completed season, which keeps the displayed FP/G meaningful until the
  // new record begins accumulating.
  const gamesPlayed = recordedGames || (hasCompletedSeasonTotals ? 17 : 0);
  const wrcPts = Math.round((sacks * 2 + defInt * 3 + fumblesRecovered * 3 + defTD * 6 + safeties * 2 + returnTD * 6 + blockKicks * 2) * 10) / 10;

  return {
    gp: gamesPlayed,
    passCmp: 0, passAtt: 0, passYds: 0, passTD: 0, passInt: 0, passRating: 0,
    rushAtt: 0, rushYds: 0, rushTD: 0,
    receptions: 0, targets: 0, recYds: 0, recTD: 0,
    fgMade: 0, fgAtt: 0, fgYds: 0, fgMade1To39: 0, fgMade40To49: 0, fgMade50To59: 0, fgMade60Plus: 0,
    xpMade: 0, xpAtt: 0,
    sacks, defInt, fumblesRecovered, takeaways: defInt + fumblesRecovered, defTD, dstTD: defTD + returnTD, returnTD, safeties, blockKicks,
    ptsAgainst: num(team.pa ?? defense.ptsAgainst),
    fumblesLost: 0,
    wrcPts,
    ptsPerGame: gamesPlayed > 0 ? Math.round((wrcPts / gamesPlayed) * 10) / 10 : 0,
  };
}
