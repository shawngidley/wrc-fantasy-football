/**
 * WRC Fantasy Football — Scoring Engine
 * Converts Tank01 raw stat objects into WRC fantasy points.
 *
 * Scoring Rules:
 *   Offense:
 *     Passing Yard:          0.04 pts/yd
 *     Rushing Yard:          0.10 pts/yd
 *     Receiving Yard:        0.10 pts/yd
 *     Reception (non-TE):    1.0  pt
 *     Reception (TE):        1.5  pts  (also applies in Flex/SuperFlex)
 *     Passing TD:            4    pts
 *     Rushing TD:            6    pts
 *     Receiving TD:          6    pts
 *     KR/PR TD:              6    pts
 *     2PT Conv Passing:      1    pt
 *     2PT Conv Rushing:      2    pts
 *     2PT Conv Receiving:    2    pts
 *     Turnover (INT/fumble): -3   pts
 *   Defense:
 *     Sack:                  2    pts
 *     INT / Fumble Recovery: 3    pts
 *     DST TD:                6    pts
 *     Safety:                2    pts
 *   Kicking:
 *     XP Made:               1    pt
 *     FG Yard Made:          0.1  pt/yd
 *     FG 60-64 yd bonus:     1    pt
 *     FG 65+ yd bonus:       2    pts
 *     XP Missed:            -2    pts
 *     FG Miss (≤49 yd):     -2    pts
 */

export interface Tank01Stats {
  Passing?: {
    passYds?: string | number;
    passTD?: string | number;
    int?: string | number;
    passingTwoPointConversion?: string | number;
    passCompletions?: string | number;
    passAttempts?: string | number;
    rtg?: string | number;
  };
  Rushing?: {
    rushYds?: string | number;
    rushTD?: string | number;
    rushingTwoPointConversion?: string | number;
    carries?: string | number;
  };
  Receiving?: {
    recYds?: string | number;
    recTD?: string | number;
    receptions?: string | number;
    targets?: string | number;
    receivingTwoPointConversion?: string | number;
  };
  Kicking?: {
    xpMade?: string | number;
    xpAttempts?: string | number;
    fgMade?: string | number;
    fgAttempts?: string | number;
    fgYds?: string | number;
    kickYards?: string | number;
    [key: string]: string | number | undefined;
  };
  Defense?: {
    sacks?: string | number;
    defensiveInterceptions?: string | number;
    fumblesRecovered?: string | number;
    defTD?: string | number;
    defensiveOrSpecialTeamsTds?: string | number;
    safeties?: string | number;
    fumblesLost?: string | number;
    returnTD?: string | number;
    blockKick?: string | number;
    ptsAgainst?: string | number;
  };
  Fumbles?: {
    fumblesLost?: string | number;
  };
  gamesPlayed?: string | number;
  teamID?: string;
  team?: string;
  teamAbv?: string;
}

function n(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const parsed = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(parsed) ? 0 : parsed;
}

export interface StatChipData {
  label: string;
  value: string | number;
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
export function buildStatChips(stats: Tank01Stats): StatChipData[] {
  const chips: StatChipData[] = [];

  const passYds = n(stats.Passing?.passYds);
  const passTD = n(stats.Passing?.passTD);
  const passInt = n(stats.Passing?.int);
  if (passYds > 0 || passTD > 0 || passInt > 0) {
    chips.push({ label: "YDS", value: passYds });
    if (passTD > 0) chips.push({ label: "TD", value: passTD });
    if (passInt > 0) chips.push({ label: "INT", value: passInt });
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

  const sacks = n(stats.Defense?.sacks);
  const defInt = n(stats.Defense?.defensiveInterceptions);
  const defTD = n(stats.Defense?.defTD) + n(stats.Defense?.defensiveOrSpecialTeamsTds);
  const fumblesRecovered = n(stats.Defense?.fumblesRecovered);
  const safeties = n(stats.Defense?.safeties);
  if (sacks > 0) chips.push({ label: "SACK", value: sacks });
  if (defInt > 0) chips.push({ label: "INT", value: defInt });
  if (fumblesRecovered > 0) chips.push({ label: "FR", value: fumblesRecovered });
  if (safeties > 0) chips.push({ label: "SFTY", value: safeties });
  if (defTD > 0) chips.push({ label: "TD", value: defTD });

  return chips;
}

/**
 * Calculate WRC fantasy points from a Tank01 stats object.
 * @param stats  - Tank01 stats object
 * @param pos    - player position ("QB" | "RB" | "WR" | "TE" | "K" | "DST")
 * @param isTE   - override to force TE reception scoring (for flex/superflex slots)
 */
export function calcFantasyPoints(
  stats: Tank01Stats,
  pos: string,
  isTE = false
): number {
  let pts = 0;
  const teReception = pos === "TE" || isTE;

  // ── Passing ──────────────────────────────────────────────────────────────
  if (stats.Passing) {
    const p = stats.Passing;
    pts += n(p.passYds) * 0.04;
    pts += n(p.passTD) * 4;
    pts += n(p.int) * -3; // INT = turnover
    pts += n(p.passingTwoPointConversion) * 1;
  }

  // ── Rushing ──────────────────────────────────────────────────────────────
  if (stats.Rushing) {
    const r = stats.Rushing;
    pts += n(r.rushYds) * 0.1;
    pts += n(r.rushTD) * 6;
    pts += n(r.rushingTwoPointConversion) * 2;
  }

  // ── Receiving ────────────────────────────────────────────────────────────
  if (stats.Receiving) {
    const rec = stats.Receiving;
    pts += n(rec.recYds) * 0.1;
    pts += n(rec.recTD) * 6;
    pts += n(rec.receptions) * (teReception ? 1.5 : 1.0);
    pts += n(rec.receivingTwoPointConversion) * 2;
  }

  // ── Fumbles lost (offense) ───────────────────────────────────────────────
  const fumblesLost = n(stats.Fumbles?.fumblesLost ?? stats.Defense?.fumblesLost);
  pts += fumblesLost * -3;

  // Individual return touchdowns score for non-D/ST players under WRC rules.
  if (pos !== "DST") pts += n(stats.Defense?.returnTD) * 6;

  // ── Kicking ──────────────────────────────────────────────────────────────
  if (stats.Kicking) {
    const k = stats.Kicking;
    const xpMade = n(k.xpMade);
    const xpAtt = n(k.xpAttempts);
    const fgMade = n(k.fgMade);
    const fgAtt = n(k.fgAttempts);
    const fgYds = n(k.fgYds); // Tank01 often returns 0 for season totals

    pts += xpMade * 1;
    const xpMissed = xpAtt - xpMade;
    pts += xpMissed * -2;

    // FG yardage scoring (0.1/yd) — only when an actual yardage aggregate is present.
    // Tank01's season player response commonly returns 0 here, so never estimate
    // a made-kick distance. Exact completed-season kicker totals use play-by-play.
    if (fgYds > 0) {
      pts += fgYds * 0.1;
    }

    // FG misses ≤49 yd penalty: Tank01 doesn't give per-attempt distances,
    // so we apply the miss penalty for all missed FGs as a conservative estimate
    const fgMissed = fgAtt - fgMade;
    pts += fgMissed * -2;
  }

  // ── DST ──────────────────────────────────────────────────────────────────
  if (pos === "DST" && stats.Defense) {
    const d = stats.Defense;
    pts += n(d.sacks) * 2;
    pts += n(d.defensiveInterceptions) * 3;
    pts += n(d.fumblesRecovered) * 3;
    const dstTouchdowns = d.defensiveOrSpecialTeamsTds !== undefined
      ? n(d.defensiveOrSpecialTeamsTds)
      : n(d.defTD) + n(d.returnTD);
    pts += dstTouchdowns * 6;
    pts += n(d.safeties) * 2;
    // Reset fumbles lost penalty for DST (doesn't apply)
    pts += fumblesLost * 3; // undo the offense fumble penalty applied above
  }

  return Math.round(pts * 10) / 10;
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
      return `${n(d.sacks)} sacks, ${n(d.defensiveInterceptions)} INT, ${n(d.defTD)} TD`;
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
