/**
 * Special-teams return touchdowns per team, read from an ESPN game summary.
 *
 * Why this exists: Tank01's D/ST block carries `defTD`, which counts only
 * touchdowns the defense itself scored (interception and fumble returns). A
 * kickoff return, punt return, blocked punt or blocked field goal returned for a
 * score is credited to the returner as a player and never reaches the D/ST line.
 * WRC's published rules award those to the D/ST -- "Defensive/ST Touchdown: +6"
 * on the Rules page -- so this fills the gap the same way field-goal distances
 * are filled in from ESPN. The 2025 static dataset already had to take return
 * touchdowns from nflverse play-by-play for the same reason; 2026 had no
 * equivalent until now.
 *
 * Interception and fumble return touchdowns are deliberately NOT counted here.
 * Tank01 already has them in `defTD`, and counting them again would double-score.
 */

export type EspnScoringPlay = {
  id?: string | number;
  type?: { text?: string; abbreviation?: string };
  text?: string;
  team?: { abbreviation?: string };
};

/**
 * A scoring play whose type -- or, failing that, its text -- says it was a
 * special-teams return for a touchdown.
 */
export function isSpecialTeamsReturnTouchdown(play: EspnScoringPlay): boolean {
  const type = (play.type?.text ?? "").toLowerCase();
  const text = (play.text ?? "").toLowerCase();
  const isTouchdown = type.includes("touchdown") || /\btouchdown\b/.test(text);
  if (!isTouchdown) return false;
  const specialTeamsType = /kickoff return|kick return|punt return|blocked punt|blocked field goal|missed field goal return/;
  // The text phrases it as an action ("returns the kickoff", "punt is BLOCKED")
  // or as a label ("86 Yd Kickoff Return"), so the text fallback -- used only
  // when ESPN gave no type -- matches those forms too.
  const specialTeamsText = /(kickoff|kick|punt)\s+return|returns? the (kickoff|kick|punt)|return of blocked (punt|field goal)|blocked (punt|field goal)|(punt|field goal)[^.]*\bblocked\b|missed field goal return/;
  return specialTeamsType.test(type) || (type === "" && specialTeamsText.test(text));
}

/**
 * Counts special-teams return touchdowns per scoring team, keyed by ESPN's
 * abbreviation exactly as given. The caller maps that to WRC's team code.
 */
export function parseEspnReturnTouchdowns(summary: unknown): Map<string, number> {
  const root = summary as { scoringPlays?: EspnScoringPlay[] };
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const play of root.scoringPlays ?? []) {
    if (!isSpecialTeamsReturnTouchdown(play)) continue;
    const team = (play.team?.abbreviation ?? "").trim().toUpperCase();
    if (!team) continue;
    // Same lesson as the kicker parser: identify a play by its id, and fall back
    // to text plus position only when there is none, so two genuinely separate
    // returns of the same length are not collapsed into one.
    const key = play.id !== undefined && play.id !== null && String(play.id) !== ""
      ? `id:${play.id}`
      : `text:${team}|${play.text ?? ""}|${seen.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}

/** Marks a defense line this has already been applied to, and remembers what the
 * provider itself reported, so re-applying on a later poll recomputes rather
 * than accumulates. */
const BASELINE_KEY = "espnReturnTdBaseline";

function num(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Folds ESPN's special-teams return touchdowns into a Tank01 defense line.
 *
 * Writes `defensiveOrSpecialTeamsTds` rather than bumping `defTD`, because that
 * is the field WRC's scorer reads FIRST -- calcFantasyPoints' DST branch uses
 * `defensiveOrSpecialTeamsTds` when present and only falls back to
 * `defTD + returnTD`. Setting it makes the total unambiguous and immune to
 * double-counting from either of those two, which is worth more here than
 * matching the provider's own shape.
 *
 * Two guards:
 *  - A provider line that ALREADY carries a combined defense + special-teams
 *    count is trusted as-is and nothing is added.
 *  - The provider's baseline is stored on first application, so the live hook
 *    re-running this every poll over stat lines it kept from earlier polls is a
 *    no-op rather than an accumulation.
 */
export function applyReturnTouchdownsToDefense(
  existingDefense: Record<string, unknown>,
  returnTouchdowns: number,
): Record<string, unknown> {
  const alreadyApplied = existingDefense[BASELINE_KEY] !== undefined;
  if (!alreadyApplied
    && existingDefense.defensiveOrSpecialTeamsTds !== undefined
    && existingDefense.defensiveOrSpecialTeamsTds !== null) {
    return existingDefense;
  }
  const baseline = alreadyApplied
    ? num(existingDefense[BASELINE_KEY])
    : num(existingDefense.defTD) + num(existingDefense.returnTD);
  return {
    ...existingDefense,
    [BASELINE_KEY]: baseline,
    defensiveOrSpecialTeamsTds: baseline + returnTouchdowns,
  };
}
