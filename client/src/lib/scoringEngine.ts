/**
 * WRC Fantasy Football — Scoring Engine (client display layer)
 *
 * The actual scoring formula (Tank01Stats, calcFantasyPoints, sacksFrom,
 * n) now lives in shared/scoringEngine.ts, used identically by both this
 * client's live-scoring display and the server's official weekly
 * finalization -- re-exported here so existing imports elsewhere in the
 * client codebase (`import { calcFantasyPoints } from "@/lib/scoringEngine"`)
 * keep working unchanged. This file now holds only the client-specific
 * display logic built on top of that shared formula: stat chips, human-
 * readable stat lines, per-game averages, and injury-status styling.
 */
export { calcFantasyPoints, sacksFrom, n, type Tank01Stats } from "@shared/scoringEngine";
import { calcFantasyPoints, sacksFrom, n, type Tank01Stats } from "@shared/scoringEngine";

export interface StatChipData {
  label: string;
  value: string | number;
  negative?: boolean;
  positive?: boolean;
}

/**
 * Builds a compact, ordered list of non-zero stat categories for display as
 * chips under a player on Live Scoring -- the raw numbers that combine to
 * produce their fantasy points total. Includes every category with actual
 * data (passing, rushing, receiving, etc.) rather than branching purely on
 * position, since e.g. a mobile QB can have both real passing and rushing
 * lines worth showing. Kept intentionally compact (yards + TDs, not every
 * single field Tank01 returns) so this fits a player's panel without
 * overflowing it.
 */
export function buildStatChips(stats: Tank01Stats, pos?: string): StatChipData[] {
  const chips: StatChipData[] = [];

  const passYds = n(stats.Passing?.passYds);
  const passTD = n(stats.Passing?.passTD);
  const passInt = n(stats.Passing?.int);
  if (passYds > 0 || passTD > 0 || passInt > 0) {
    chips.push({ label: "YDS", value: passYds });
    if (passTD > 0) chips.push({ label: "TD", value: passTD });
    if (passInt > 0) chips.push({ label: "INT", value: passInt, negative: true });
  }

  const rushYds = n(stats.Rushing?.rushYds);
  const rushTD = n(stats.Rushing?.rushTD);
  const carries = n(stats.Rushing?.carries);
  if (carries > 0 || rushYds !== 0 || rushTD > 0) {
    chips.push({ label: "RUSH", value: rushYds });
    if (rushTD > 0) chips.push({ label: "TD", value: rushTD });
  }

  const recYds = n(stats.Receiving?.recYds);
  const recTD = n(stats.Receiving?.recTD);
  const receptions = n(stats.Receiving?.receptions);
  if (receptions > 0 || recYds > 0 || recTD > 0) {
    chips.push({ label: "REC", value: receptions });
    chips.push({ label: "YDS", value: recYds });
    if (recTD > 0) chips.push({ label: "TD", value: recTD });
  }

  // Fumbles lost by the offensive player -- previously not shown as a
  // chip at all, despite costing points the same way a thrown
  // interception does. Same fallback as calcFantasyPoints below: Tank01
  // sometimes reports this under Defense rather than Fumbles for a
  // given player, and the scoring formula already accounts for that --
  // the chip display needs the same fallback or it can miss a fumble
  // that was still correctly deducted from the player's score.
  // IMPORTANT: this fallback must never apply to an actual DST's own
  // stats.Defense object -- confirmed live, Detroit's DST incorrectly
  // showed a red "FUM" chip (meant for an offensive fumble lost) built
  // from stats.Defense.fumblesLost, when that DST's own fumble credit
  // is already correctly and independently handled by fumblesRecovered
  // below. Reusing the same field for both concepts double-counts.
  const fumblesLost = pos === "DST" ? 0 : n(stats.Fumbles?.fumblesLost ?? stats.Defense?.fumblesLost);
  if (fumblesLost > 0) chips.push({ label: "FUM", value: fumblesLost, negative: true });

  const fgMade = stats.Kicking?.fgMade;
  const fgAttempts = stats.Kicking?.fgAttempts;
  if (fgMade !== undefined || fgAttempts !== undefined) {
    chips.push({ label: "FG", value: `${n(fgMade)}/${n(fgAttempts)}` });
  }
  const xpMade = stats.Kicking?.xpMade;
  const xpAttempts = stats.Kicking?.xpAttempts;
  if (xpMade !== undefined || xpAttempts !== undefined) {
    chips.push({ label: "XP", value: `${n(xpMade)}/${n(xpAttempts)}` });
  }

  // DST-specific categories (sacks, interceptions, fumble recoveries,
  // safeties, defensive/special-teams TDs) only ever apply to an actual
  // DST entry. Confirmed live: an individual offensive player (Travis
  // Etienne Jr., an RB) who personally recovered his own team's own
  // fumble incorrectly showed an "FR" chip, since Tank01 apparently
  // tracks fumble recovery under a Defense.fumblesRecovered field even
  // for an offensive player who happens to recover one -- gating this
  // whole block to pos === "DST" prevents any of these categories from
  // leaking onto an individual offensive player's stat chips.
  if (pos === "DST") {
    const sacks = stats.Defense ? sacksFrom(stats.Defense) : 0;
    const defInt = n(stats.Defense?.defensiveInterceptions);
    const defTD = n(stats.Defense?.defTD) + n(stats.Defense?.defensiveOrSpecialTeamsTds);
    const fumblesRecovered = n(stats.Defense?.fumblesRecovered);
    const safeties = n(stats.Defense?.safeties);
    if (sacks > 0) chips.push({ label: "SACK", value: sacks });
    if (defInt > 0) chips.push({ label: "INT", value: defInt });
    if (fumblesRecovered > 0) chips.push({ label: "FR", value: fumblesRecovered });
    if (safeties > 0) chips.push({ label: "SFTY", value: safeties });
    if (defTD > 0) chips.push({ label: "TD", value: defTD });
  }

  return chips;
}


/**
 * Get a human-readable stat line for a player based on their position.
 */
export function getStatLine(stats: Tank01Stats, pos: string): string {
  const gp = n(stats.gamesPlayed);
  if (!gp) return "No stats available";

  switch (pos) {
    case "QB": {
      const p = stats.Passing ?? {};
      const r = stats.Rushing ?? {};
      const cmp = n(p.passCompletions);
      const att = n(p.passAttempts);
      const yds = n(p.passYds);
      const td = n(p.passTD);
      const int_ = n(p.int);
      const rushYds = n(r.rushYds);
      const rushTd = n(r.rushTD);
      return `${cmp}/${att}, ${yds.toLocaleString()} yds, ${td} TD, ${int_} INT${rushYds > 0 ? ` · ${rushYds} rush yds, ${rushTd} rush TD` : ""}`;
    }
    case "RB": {
      const r = stats.Rushing ?? {};
      const rec = stats.Receiving ?? {};
      const rushYds = n(r.rushYds);
      const rushTd = n(r.rushTD);
      const carries = n(r.carries);
      const receptions = n(rec.receptions);
      const recYds = n(rec.recYds);
      const recTd = n(rec.recTD);
      return `${carries} car, ${rushYds.toLocaleString()} yds, ${rushTd} TD${receptions > 0 ? ` · ${receptions} rec, ${recYds} yds, ${recTd} TD` : ""}`;
    }
    case "WR":
    case "TE": {
      const rec = stats.Receiving ?? {};
      const receptions = n(rec.receptions);
      const targets = n(rec.targets);
      const recYds = n(rec.recYds);
      const recTd = n(rec.recTD);
      return `${receptions}/${targets} tgt, ${recYds.toLocaleString()} yds, ${recTd} TD`;
    }
    case "K": {
      const k = stats.Kicking ?? {};
      const fgMade = n(k.fgMade);
      const fgAtt = n(k.fgAttempts);
      const xpMade = n(k.xpMade);
      const xpAtt = n(k.xpAttempts);
      return `${fgMade}/${fgAtt} FG, ${xpMade}/${xpAtt} XP`;
    }
    case "DST": {
      const d = stats.Defense ?? {};
      return `${sacksFrom(d)} sacks, ${n(d.defensiveInterceptions)} INT, ${n(d.defTD)} TD`;
    }
    default:
      return `${gp} games played`;
  }
}

/**
 * Get per-game average fantasy points.
 */
export function getPerGameAvg(stats: Tank01Stats, pos: string): number {
  const gp = n(stats.gamesPlayed);
  if (!gp) return 0;
  const total = calcFantasyPoints(stats, pos);
  return Math.round((total / gp) * 10) / 10;
}

/**
 * Injury designation color
 */
export function injuryColor(designation: string): string {
  switch (designation?.toLowerCase()) {
    case "out": return "text-red-600 bg-red-50";
    case "doubtful": return "text-orange-600 bg-orange-50";
    case "questionable": return "text-yellow-600 bg-yellow-50";
    case "ir": return "text-red-700 bg-red-100";
    case "pup": return "text-purple-600 bg-purple-50";
    default: return "text-green-600 bg-green-50";
  }
}

export function injuryLabel(designation: string): string {
  if (!designation) return "Active";
  return designation;
}
