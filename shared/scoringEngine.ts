/**
 * WRC Fantasy Football — Scoring Engine (shared)
 * Converts Tank01 raw stat objects into WRC fantasy points.
 *
 * Used by both the client's live-scoring display (useNFLLiveScores.ts)
 * and the server's official weekly finalization
 * (weeklyResultsFinalize.ts) -- moved here specifically so both paths
 * compute points identically. Kicker scoring is the one exception:
 * live display prefers a separate, ESPN-event-based calculation when
 * available (calculateWrcKickerPoints, client-only, since it depends
 * on live in-game event data the server's finalization path doesn't
 * have access to after the fact) -- the Kicking section below is used
 * as the fallback/baseline for both sides.
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
    sacksAndYardsLost?: string;
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

export function n(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const parsed = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Tank01's team defense stats don't include a plain "sacks" number --
 * confirmed live: the actual field is "sacksAndYardsLost", a combined
 * string like "3-10" (3 sacks for 10 yards). Looking for d.sacks
 * directly always silently returned 0 regardless of the real sack
 * count, since that field simply doesn't exist under that name.
 * Prefers a plain "sacks" field if one is ever present, for robustness
 * against a different response shape.
 */
export function sacksFrom(d: { sacks?: string | number; sacksAndYardsLost?: string }): number {
  if (d.sacks !== undefined) return n(d.sacks);
  const combined = d.sacksAndYardsLost;
  if (typeof combined === "string") {
    const first = parseFloat(combined.split("-")[0]);
    return isNaN(first) ? 0 : first;
  }
  return 0;
}

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
  // Never applies to DST -- a DST's own fumble credit is handled
  // entirely and correctly by fumblesRecovered in the DST branch below.
  // Confirmed live: Detroit's DST was incorrectly hit with this -3
  // penalty from stats.Defense.fumblesLost (a Tank01 field that doesn't
  // represent a DST's own negative event), which the DST branch then
  // tried to "undo" with a same-sized +3 -- but that undo was applied
  // on top of the already-correct +3 from fumblesRecovered, silently
  // netting to the DST's score depending on whether the two field
  // values happened to match. Gating this to 0 for DST up front removes
  // the bug and the need for that undo entirely.
  const fumblesLost = pos === "DST" ? 0 : n(stats.Fumbles?.fumblesLost ?? stats.Defense?.fumblesLost);
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
    pts += sacksFrom(d) * 2;
    pts += n(d.defensiveInterceptions) * 3;
    pts += n(d.fumblesRecovered) * 3;
    const dstTouchdowns = d.defensiveOrSpecialTeamsTds !== undefined
      ? n(d.defensiveOrSpecialTeamsTds)
      : n(d.defTD) + n(d.returnTD);
    pts += dstTouchdowns * 6;
    pts += n(d.safeties) * 2;
    // NOTE: no points-allowed category -- confirmed with the commissioner
    // that WRC's actual DST rules are exactly: sack (2), fumble/
    // interception (3 each), touchdown (6), safety (2). No points-allowed
    // tier exists. (A points-allowed category was briefly added here and
    // in the server-side final scoring, then removed once confirmed it
    // wasn't part of the real ruleset.)
  }

  return Math.round(pts * 10) / 10;
}
