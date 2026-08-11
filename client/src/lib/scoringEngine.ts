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
  };
  Defense?: {
    sacks?: string | number;
    defensiveInterceptions?: string | number;
    fumblesRecovered?: string | number;
    defTD?: string | number;
    safeties?: string | number;
    fumblesLost?: string | number;
    returnTD?: string | number;
    blockKick?: string | number;
    ptsAgainst?: string | number;
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
  if (stats.Defense) {
    pts += n(stats.Defense.fumblesLost) * -3;
  }

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

    // FG yardage scoring (0.1/yd) — if fgYds is available
    if (fgYds > 0) {
      pts += fgYds * 0.1;
    } else if (fgMade > 0) {
      // Estimate: assume average FG distance of ~38 yards when no yardage data
      pts += fgMade * 38 * 0.1;
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
    pts += n(d.defTD) * 6;
    pts += n(d.safeties) * 2;
    // Reset fumbles lost penalty for DST (doesn't apply)
    pts -= n(d.fumblesLost) * -3; // undo the offense fumble penalty applied above
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
