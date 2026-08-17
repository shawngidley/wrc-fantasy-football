/**
 * WRC Player Season Stats
 * Style: compact, position-aware NFL tables with gold WRC scoring emphasis.
 * Converts Tank01 player-info season totals into a flat table shape shared by
 * the Player Card and Free Agents stats view.
 */
import { calcFantasyPoints, type Tank01Stats } from "@/lib/scoringEngine";

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
  defTD: number;
  returnTD: number;
  safeties: number;
  blockKicks: number;
  ptsAgainst: number;
  fumblesLost: number;
  wrcPts: number;
  ptsPerGame: number;
}

export type SeasonStatKey = keyof PlayerSeasonStats;

export interface SeasonStatColumn {
  label: string;
  key: SeasonStatKey;
  decimals?: number;
  gold?: boolean;
  highlight?: boolean;
  pair?: readonly [SeasonStatKey, SeasonStatKey];
}

const num = (value: string | number | undefined): number => {
  const result = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(result) ? result : 0;
};

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
    defInt: num(defense.defensiveInterceptions),
    fumblesRecovered: num(defense.fumblesRecovered),
    defTD: num(defense.defTD),
    returnTD: num(defense.returnTD),
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
 * player-info endpoint. This converts that team response to the Lineup table's
 * shared stat shape.
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
    sacks, defInt, fumblesRecovered, defTD, returnTD, safeties, blockKicks,
    ptsAgainst: num(team.pa ?? defense.ptsAgainst),
    fumblesLost: 0,
    wrcPts,
    ptsPerGame: gamesPlayed > 0 ? Math.round((wrcPts / gamesPlayed) * 10) / 10 : 0,
  };
}

export function getSeasonStatColumns(pos: string): SeasonStatColumn[] {
  const fantasy: SeasonStatColumn[] = [
    { label: "WRC PTS", key: "wrcPts", decimals: 1, gold: true },
    { label: "PTS/G", key: "ptsPerGame", decimals: 1, gold: true },
  ];

  switch (pos) {
    case "QB":
      return [
        { label: "GP", key: "gp" },
        { label: "CMP/ATT", key: "passCmp", pair: ["passCmp", "passAtt"], highlight: true },
        { label: "PASS YDS", key: "passYds", highlight: true },
        { label: "PASS TD", key: "passTD", highlight: true },
        { label: "INT", key: "passInt" },
        { label: "RATE", key: "passRating", decimals: 1 },
        { label: "RUSH ATT", key: "rushAtt" },
        { label: "RUSH YDS", key: "rushYds" },
        { label: "RUSH TD", key: "rushTD" },
        { label: "FUM LST", key: "fumblesLost" },
        ...fantasy,
      ];
    case "RB":
      return [
        { label: "GP", key: "gp" },
        { label: "CAR", key: "rushAtt", highlight: true },
        { label: "RUSH YDS", key: "rushYds", highlight: true },
        { label: "RUSH TD", key: "rushTD", highlight: true },
        { label: "REC", key: "receptions" },
        { label: "TGT", key: "targets" },
        { label: "REC YDS", key: "recYds" },
        { label: "REC TD", key: "recTD" },
        { label: "FUM LST", key: "fumblesLost" },
        ...fantasy,
      ];
    case "WR":
    case "TE":
      return [
        { label: "GP", key: "gp" },
        { label: "REC", key: "receptions", highlight: true },
        { label: "TGT", key: "targets" },
        { label: "REC YDS", key: "recYds", highlight: true },
        { label: "REC TD", key: "recTD", highlight: true },
        { label: "RUSH ATT", key: "rushAtt" },
        { label: "RUSH YDS", key: "rushYds" },
        { label: "RUSH TD", key: "rushTD" },
        { label: "FUM LST", key: "fumblesLost" },
        ...fantasy,
      ];
    case "K":
    case "PK":
      return [
        { label: "GP", key: "gp" },
        { label: "FGM/FGA", key: "fgMade", pair: ["fgMade", "fgAtt"], highlight: true },
        { label: "FG YDS", key: "fgYds" },
        { label: "XPM/XPA", key: "xpMade", pair: ["xpMade", "xpAtt"] },
        ...fantasy,
      ];
    case "DST":
      return [
        { label: "GP", key: "gp" },
        { label: "SACK", key: "sacks", highlight: true },
        { label: "INT", key: "defInt", highlight: true },
        { label: "FR", key: "fumblesRecovered" },
        { label: "DEF TD", key: "defTD", highlight: true },
        { label: "RET TD", key: "returnTD" },
        { label: "SFTY", key: "safeties" },
        { label: "BLK", key: "blockKicks" },
        { label: "PA", key: "ptsAgainst" },
        ...fantasy,
      ];
    default:
      return [{ label: "GP", key: "gp" }, ...fantasy];
  }
}

export function formatSeasonStat(value: number, decimals = 0): string {
  if (!value) return "—";
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
}

export function formatSeasonStatColumn(row: PlayerSeasonStats, column: SeasonStatColumn): string {
  if (column.pair) {
    const [left, right] = column.pair;
    const hasStat = row[left] > 0 || row[right] > 0;
    return hasStat ? `${formatSeasonStat(row[left])}/${formatSeasonStat(row[right])}` : "—";
  }
  return formatSeasonStat(row[column.key], column.decimals);
}
