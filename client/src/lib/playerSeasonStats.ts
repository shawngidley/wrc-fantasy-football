/**
 * WRC Player Season Stats (client display layer)
 *
 * The core PlayerSeasonStats type and the raw-Tank01-stats normalizers
 * (normalizeTankSeasonStats, normalizeTankTeamSeasonStats) now live in
 * shared/playerSeasonStats.ts, used identically by both this client's
 * display logic and the server's persistence of per-player weekly stats
 * (server/weeklyResultsFinalize.ts writes to the player_weekly_stats
 * table using the exact same transformation, so a player's season total
 * is computed once and read everywhere, rather than independently
 * recomputed client-side from Tank01/ESPN on every page load). Re-exported
 * here so existing imports elsewhere in the client codebase keep working
 * unchanged. This file now holds only the client-specific pieces built on
 * top of that shared logic: the static-2025-snapshot normalizers, column
 * definitions, and display formatting.
 */
export { type Tank01TeamSeasonStats, type PlayerSeasonStats, normalizeTankSeasonStats, normalizeTankTeamSeasonStats } from "@shared/playerSeasonStats";
import type { PlayerSeasonStats } from "@shared/playerSeasonStats";
import { calcFantasyPoints } from "@shared/scoringEngine";
import type { CompletedDstSeasonStats } from "@/lib/dstSeasonStats2025";
import type { CompletedKickerSeasonStats } from "@/lib/kickerSeasonStats2025";

const num = (value: string | number | undefined): number => {
  const result = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(result) ? result : 0;
};

export type SeasonStatKey = keyof PlayerSeasonStats;

export interface SeasonStatColumn {
  label: string;
  key: SeasonStatKey;
  decimals?: number;
  gold?: boolean;
  highlight?: boolean;
  pair?: readonly [SeasonStatKey, SeasonStatKey];
}


/**
 * Converts a completed, reconciled D/ST season into the Lineup table shape.
 * This avoids Tank01's ambiguous team-level fumblesRecovered aggregate.
 */
export function normalizeCompletedDstSeasonStats(source: CompletedDstSeasonStats): PlayerSeasonStats {
  const wrcPts = calcFantasyPoints({
    gamesPlayed: source.games,
    Defense: {
      sacks: source.sacks,
      defensiveInterceptions: source.defInt,
      fumblesRecovered: source.fumblesRecovered,
      defTD: source.dstTD,
      safeties: source.safeties,
    },
  }, "DST");

  return {
    gp: source.games,
    passCmp: 0, passAtt: 0, passYds: 0, passTD: 0, passInt: 0, passRating: 0,
    rushAtt: 0, rushYds: 0, rushTD: 0,
    receptions: 0, targets: 0, recYds: 0, recTD: 0,
    fgMade: 0, fgAtt: 0, fgYds: 0, fgMade1To39: 0, fgMade40To49: 0, fgMade50To59: 0, fgMade60Plus: 0,
    xpMade: 0, xpAtt: 0,
    sacks: source.sacks,
    defInt: source.defInt,
    fumblesRecovered: source.fumblesRecovered,
    takeaways: source.takeaways,
    defTD: source.dstTD,
    dstTD: source.dstTD,
    returnTD: 0,
    safeties: source.safeties,
    blockKicks: 0,
    ptsAgainst: source.ptsAgainst,
    fumblesLost: 0,
    wrcPts,
    ptsPerGame: Math.round((wrcPts / source.games) * 10) / 10,
  };
}

/** Converts exact event-derived completed kicker totals into the Lineup stat shape. */
export function normalizeCompletedKickerSeasonStats(source: CompletedKickerSeasonStats): PlayerSeasonStats {
  return {
    gp: source.games,
    passCmp: 0, passAtt: 0, passYds: 0, passTD: 0, passInt: 0, passRating: 0,
    rushAtt: 0, rushYds: 0, rushTD: 0,
    receptions: 0, targets: 0, recYds: 0, recTD: 0,
    fgMade: source.fgm, fgAtt: source.fga, fgYds: 0, fgMade1To39: 0, fgMade40To49: 0, fgMade50To59: 0, fgMade60Plus: 0,
    xpMade: source.xpm, xpAtt: source.xpa,
    sacks: 0, defInt: 0, fumblesRecovered: 0, takeaways: 0, defTD: 0, dstTD: 0, returnTD: 0, safeties: 0, blockKicks: 0, ptsAgainst: 0,
    fumblesLost: 0,
    wrcPts: source.wrcPts,
    ptsPerGame: source.games > 0 ? Math.round((source.wrcPts / source.games) * 10) / 10 : 0,
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
