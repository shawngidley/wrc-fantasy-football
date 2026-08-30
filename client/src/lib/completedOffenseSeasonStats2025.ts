import type { PlayerSeasonStats } from "./playerSeasonStats";

export interface CompletedOffenseSeasonStatLine {
  pos: "QB" | "RB" | "WR" | "TE";
  passYds: number;
  passTd: number;
  passInt: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  tgt: number;
  recYds: number;
  recTd: number;
  fumblesLost: number;
  returnTd: number;
  games: number;
}

const SNAPSHOT_URL = "/api/season-stats-2025";
let snapshotPromise: Promise<Record<string, CompletedOffenseSeasonStatLine>> | null = null;

export function getCompletedOffenseSeasonStats2025(): Promise<Record<string, CompletedOffenseSeasonStatLine>> {
  if (!snapshotPromise) {
    snapshotPromise = fetch(SNAPSHOT_URL, { cache: "no-store" })
      .then(response => response.ok ? response.json() : {})
      .catch(() => ({}));
  }
  return snapshotPromise;
}

export function normalizeCompletedOffenseSeasonStats(line: CompletedOffenseSeasonStatLine): PlayerSeasonStats {
  const points =
    line.passYds * 0.04 + line.passTd * 4 - line.passInt * 3 +
    line.rushYds * 0.1 + line.rushTd * 6 +
    line.recYds * 0.1 + line.recTd * 6 +
    line.rec * (line.pos === "TE" ? 1.5 : 1) +
    line.returnTd * 6 - line.fumblesLost * 3;
  const wrcPts = Math.round(points * 10) / 10;
  return {
    gp: line.games,
    passCmp: 0,
    passAtt: 0,
    passYds: line.passYds,
    passTD: line.passTd,
    passInt: line.passInt,
    passRating: 0,
    rushAtt: line.rushAtt,
    rushYds: line.rushYds,
    rushTD: line.rushTd,
    receptions: line.rec,
    targets: line.tgt,
    recYds: line.recYds,
    recTD: line.recTd,
    fumblesLost: line.fumblesLost,
    returnTD: line.returnTd,
    fgMade: 0,
    fgAtt: 0,
    fgYds: 0,
    fgMade1To39: 0,
    fgMade40To49: 0,
    fgMade50To59: 0,
    fgMade60Plus: 0,
    xpMade: 0,
    xpAtt: 0,
    sacks: 0,
    defInt: 0,
    fumblesRecovered: 0,
    takeaways: 0,
    defTD: 0,
    dstTD: 0,
    safeties: 0,
    blockKicks: 0,
    ptsAgainst: 0,
    wrcPts,
    ptsPerGame: line.games > 0 ? Math.round((wrcPts / line.games) * 10) / 10 : 0,
  };
}
