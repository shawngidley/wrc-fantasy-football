/**
 * Playoff math for the Playoffs page: standings through any week, the six
 * seeds, who has clinched or been eliminated, and the bracket.
 *
 * League rules this follows:
 * - Seeding is by most wins. A week is worth up to 3 wins: 2 for beating your
 *   opponent and 1 for beating the league median (see weeklyRecordDelta).
 * - 6 teams make it: the 3 division winners (seeds 1 to 3) and the 3 best
 *   other records (seeds 4 to 6). Ties go to points for.
 * - Seeds 1 and 2 skip Week 15. In Week 16 the top seed plays the lowest
 *   remaining seed. Week 17 is the championship.
 *
 * Only regular season weeks count toward seeding. Note that the official
 * team_standings recompute has no such ceiling -- it folds in every final
 * week, playoffs included -- so from Week 15 the Standings page's W-L can run
 * ahead of the records here.
 */

export const REGULAR_SEASON_WEEKS = 14;
export const MAX_WINS_PER_WEEK = 3;

/** Weeks 15 to 17. There is no league median in the playoffs, and these weeks never count toward the season record. */
export function isPlayoffWeek(week: number): boolean {
  return week > REGULAR_SEASON_WEEKS;
}

export type Division = "East" | "Central" | "West";
export const DIVISIONS: readonly Division[] = ["East", "Central", "West"];

export interface PlayoffTeam {
  owner: string;
  teamName: string;
  division: Division;
}

export interface ResultRow {
  week: number;
  home_owner: string;
  away_owner: string;
  home_score: number | string | null;
  away_score: number | string | null;
  is_final: boolean;
}

export interface TeamLine extends PlayoffTeam {
  wins: number;
  losses: number;
  ptsFor: number;
}

/**
 * Wins and losses a team earns in one week. This mirrors weeklyResultsFinalize's
 * weeklyRecordDelta, which is what writes the official standings. A test keeps
 * the two identical.
 */
export function weeklyRecordDelta(h2h: "W" | "L" | "T", beatMedian: boolean): { winsDelta: number; lossesDelta: number } {
  let winsDelta = 0;
  let lossesDelta = 0;
  if (h2h === "W") winsDelta += 2;
  if (h2h === "L") lossesDelta += 2;
  if (beatMedian) winsDelta += 1; else lossesDelta += 1;
  return { winsDelta, lossesDelta };
}

function num(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The regular season weeks that are final, oldest first. */
export function finalRegularSeasonWeeks(rows: readonly ResultRow[]): number[] {
  const weeks = new Set<number>();
  for (const row of rows) {
    if (row.is_final && row.week >= 1 && row.week <= REGULAR_SEASON_WEEKS) weeks.add(row.week);
  }
  return Array.from(weeks).sort((a, b) => a - b);
}

/** Every team's record using only final regular season weeks up to `throughWeek`. */
export function standingsThroughWeek(teams: readonly PlayoffTeam[], rows: readonly ResultRow[], throughWeek: number): TeamLine[] {
  const lines = new Map<string, TeamLine>(teams.map(t => [t.owner, { ...t, wins: 0, losses: 0, ptsFor: 0 }]));
  const byWeek = new Map<number, ResultRow[]>();
  for (const row of rows) {
    if (!row.is_final || row.week < 1 || row.week > REGULAR_SEASON_WEEKS || row.week > throughWeek) continue;
    const list = byWeek.get(row.week) ?? [];
    list.push(row);
    byWeek.set(row.week, list);
  }
  byWeek.forEach(weekRows => {
    const weekMedian = median(weekRows.flatMap(r => [num(r.home_score), num(r.away_score)]));
    for (const row of weekRows) {
      const sides = [
        { owner: row.home_owner, score: num(row.home_score), opp: num(row.away_score) },
        { owner: row.away_owner, score: num(row.away_score), opp: num(row.home_score) },
      ];
      for (const side of sides) {
        const line = lines.get(side.owner);
        if (!line) continue;
        const outcome = side.score > side.opp ? "W" : side.score < side.opp ? "L" : "T";
        const { winsDelta, lossesDelta } = weeklyRecordDelta(outcome, side.score > weekMedian);
        line.wins += winsDelta;
        line.losses += lossesDelta;
        line.ptsFor += side.score;
      }
    }
  });
  return Array.from(lines.values());
}

type TieMode = "actual" | { favor: string } | { against: string };

function makeComparator(mode: TieMode) {
  return (a: TeamLine, b: TeamLine): number => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (mode !== "actual") {
      const subject = "favor" in mode ? mode.favor : mode.against;
      const sign = "favor" in mode ? -1 : 1;
      if (a.owner === subject) return sign;
      if (b.owner === subject) return -sign;
    }
    return b.ptsFor - a.ptsFor || a.owner.localeCompare(b.owner);
  };
}

export interface SeedEntry {
  seed: number;
  line: TeamLine;
  kind: "division" | "wildcard";
  bye: boolean;
}

export interface SeedField {
  seeds: SeedEntry[];
  /** Teams outside the six, best record first. */
  rest: TeamLine[];
}

function seedFieldWith(lines: readonly TeamLine[], compare: (a: TeamLine, b: TeamLine) => number): SeedField {
  const winners: TeamLine[] = [];
  const others: TeamLine[] = [];
  for (const division of DIVISIONS) {
    const inDivision = lines.filter(l => l.division === division).sort(compare);
    if (inDivision.length === 0) continue;
    winners.push(inDivision[0]);
    others.push(...inDivision.slice(1));
  }
  winners.sort(compare);
  others.sort(compare);
  const wildCards = others.slice(0, 3);
  const seeds: SeedEntry[] = [
    ...winners.map(line => ({ line, kind: "division" as const })),
    ...wildCards.map(line => ({ line, kind: "wildcard" as const })),
  ].map((entry, i) => ({ seed: i + 1, line: entry.line, kind: entry.kind, bye: i < 2 }));
  return { seeds, rest: others.slice(3) };
}

/** The six seeds and the rest, using the real tiebreaker (points for). */
export function seedField(lines: readonly TeamLine[]): SeedField {
  return seedFieldWith(lines, makeComparator("actual"));
}

export type ClinchStatus = "division" | "playoff" | "eliminated" | "alive";

/**
 * Who has clinched or is out, and only when no outcome can change it.
 *
 * Clinched: give every other team the most wins it could still reach (3 a
 * week), give this team none more, and break every tie against it. If it is
 * still in, it is in. Eliminated: the reverse, with this team winning
 * everything and every tie. These checks ignore that two teams can't both
 * sweep the same matchup, so they never claim something that isn't certain.
 * The cost is that a clinch can show a week after the true math allows it.
 */
export function clinchStatuses(lines: readonly TeamLine[], weeksLeft: number): Map<string, ClinchStatus> {
  const result = new Map<string, ClinchStatus>();
  const left = Math.max(0, weeksLeft);
  const actual = seedField(lines);
  const inField = new Set(actual.seeds.map(s => s.line.owner));
  const divisionWinner = new Set(actual.seeds.filter(s => s.kind === "division").map(s => s.line.owner));

  for (const team of lines) {
    if (left === 0) {
      result.set(team.owner, divisionWinner.has(team.owner) ? "division" : inField.has(team.owner) ? "playoff" : "eliminated");
      continue;
    }
    const worst = lines.map(l => (l.owner === team.owner ? l : { ...l, wins: l.wins + MAX_WINS_PER_WEEK * left }));
    const worstField = seedFieldWith(worst, makeComparator({ against: team.owner }));
    const worstEntry = worstField.seeds.find(s => s.line.owner === team.owner);
    if (worstEntry) {
      result.set(team.owner, worstEntry.kind === "division" ? "division" : "playoff");
      continue;
    }
    const best = lines.map(l => (l.owner === team.owner ? { ...l, wins: l.wins + MAX_WINS_PER_WEEK * left } : l));
    const bestField = seedFieldWith(best, makeComparator({ favor: team.owner }));
    result.set(team.owner, bestField.seeds.some(s => s.line.owner === team.owner) ? "alive" : "eliminated");
  }
  return result;
}

export interface MagicNumbers {
  /** More wins that guarantee a playoff spot, or null if even a sweep can't guarantee one yet. */
  toClinch: number | null;
  /** More wins that guarantee the division title, or null if even a sweep can't. */
  toClinchDivision: number | null;
  /** The fewest more wins a team can finish with and still be alive, or null if it is already out. */
  toStayAlive: number | null;
}

/**
 * Magic numbers, in wins (a week is worth up to 3). They use the same cautious
 * scenarios as clinchStatuses: to clinch, every rival sweeps and every tie goes
 * against the team; to stay alive, the team sweeps, every rival adds nothing,
 * and every tie goes its way.
 */
export function magicNumbers(lines: readonly TeamLine[], weeksLeft: number): Map<string, MagicNumbers> {
  const left = Math.max(0, weeksLeft);
  const cap = MAX_WINS_PER_WEEK * left;
  const out = new Map<string, MagicNumbers>();
  for (const team of lines) {
    const worstEntry = (extra: number) => {
      const worst = lines.map(l => (l.owner === team.owner ? { ...l, wins: l.wins + extra } : { ...l, wins: l.wins + cap }));
      return seedFieldWith(worst, makeComparator({ against: team.owner })).seeds.find(s => s.line.owner === team.owner);
    };
    const bestIn = (extra: number) => {
      const best = lines.map(l => (l.owner === team.owner ? { ...l, wins: l.wins + extra } : l));
      return seedFieldWith(best, makeComparator({ favor: team.owner })).seeds.some(s => s.line.owner === team.owner);
    };
    let toClinch: number | null = null;
    let toClinchDivision: number | null = null;
    let toStayAlive: number | null = null;
    for (let extra = 0; extra <= cap; extra++) {
      const entry = worstEntry(extra);
      if (toClinch === null && entry) toClinch = extra;
      if (toClinchDivision === null && entry?.kind === "division") toClinchDivision = extra;
      if (toStayAlive === null && bestIn(extra)) toStayAlive = extra;
    }
    out.set(team.owner, { toClinch, toClinchDivision, toStayAlive });
  }
  return out;
}

/**
 * A short note for each team that is tied on wins with a neighbor in the
 * standings, saying who wins the tiebreaker (points for) and by how much.
 * Only ties that decide something are noted: neighbors in the same group
 * (both division winners, or both competing for wild cards), and a division
 * winner against a division mate on the same record.
 */
export function tiebreakNotes(field: SeedField): Map<string, string> {
  const ordered = [
    ...field.seeds.map(s => ({ line: s.line, tier: s.kind })),
    ...field.rest.map(line => ({ line, tier: "wildcard" as const })),
  ];
  const notes = new Map<string, string>();
  const addPair = (hi: TeamLine, lo: TeamLine) => {
    const gap = hi.ptsFor - lo.ptsFor;
    const wins = `${hi.wins} ${hi.wins === 1 ? "win" : "wins"}`;
    const detail = gap === 0 ? "Even on points too." : null;
    if (!notes.has(hi.owner)) notes.set(hi.owner, `Tied with ${lo.teamName} at ${wins}. ${detail ?? `Ahead on points by ${gap.toFixed(1)}.`}`);
    if (!notes.has(lo.owner)) notes.set(lo.owner, `Tied with ${hi.teamName} at ${wins}. ${detail ?? `Behind on points by ${gap.toFixed(1)}.`}`);
  };
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (a.line.wins === b.line.wins && a.tier === b.tier) addPair(a.line, b.line);
  }
  for (const entry of ordered.filter(e => e.tier === "division")) {
    for (const mate of ordered) {
      if (mate.line.division === entry.line.division && mate.line.owner !== entry.line.owner && mate.line.wins === entry.line.wins) {
        addPair(entry.line, mate.line);
      }
    }
  }
  return notes;
}

export interface RemainingSchedule {
  /** Opponent owners for the regular season weeks still to play, in order. */
  opponents: string[];
  /** The opponents' combined win percentage so far, or null if none have played. */
  opponentWinPct: number | null;
}

interface ScheduleLike {
  week: number;
  type: string;
  matchups: readonly (readonly [string, string])[];
}

/** Each team's remaining regular season opponents and how strong they have been. */
export function remainingSchedule(schedule: readonly ScheduleLike[], lines: readonly TeamLine[], throughWeek: number): Map<string, RemainingSchedule> {
  const byOwner = new Map(lines.map(l => [l.owner, l]));
  const out = new Map<string, RemainingSchedule>();
  for (const team of lines) {
    const opponents: string[] = [];
    for (const week of schedule) {
      if (week.type !== "regular" || week.week <= throughWeek || week.week > REGULAR_SEASON_WEEKS) continue;
      const game = week.matchups.find(m => m[0] === team.owner || m[1] === team.owner);
      if (game) opponents.push(game[0] === team.owner ? game[1] : game[0]);
    }
    let wins = 0;
    let total = 0;
    for (const owner of opponents) {
      const opp = byOwner.get(owner);
      if (!opp) continue;
      wins += opp.wins;
      total += opp.wins + opp.losses;
    }
    out.set(team.owner, { opponents, opponentWinPct: total > 0 ? wins / total : null });
  }
  return out;
}

/** How each team's seed moved between two points in the season. */
export function seedMovement(previous: readonly SeedEntry[] | null, current: readonly SeedEntry[]): Map<string, { previousSeed: number | null; change: number }> {
  const before = new Map((previous ?? []).map(s => [s.line.owner, s.seed]));
  const out = new Map<string, { previousSeed: number | null; change: number }>();
  for (const entry of current) {
    const prior = before.get(entry.line.owner) ?? null;
    out.set(entry.line.owner, { previousSeed: prior, change: previous && prior !== null ? prior - entry.seed : 0 });
  }
  return out;
}

// ── Bracket ──────────────────────────────────────────────────────────────────

export interface BracketSide {
  /** Shown when the team isn't known yet, e.g. "Winner of Game 1". */
  label: string;
  seed: number | null;
  owner: string | null;
  teamName: string | null;
  score: number | null;
}

export interface BracketGame {
  id: "wc1" | "wc2" | "sf1" | "sf2" | "final";
  round: "wildcard" | "semifinal" | "final";
  week: number;
  title: string;
  top: BracketSide;
  bottom: BracketSide;
  final: boolean;
  winnerSeed: number | null;
}

const unknownSide = (label: string): BracketSide => ({ label, seed: null, owner: null, teamName: null, score: null });

function seedSide(entry: SeedEntry): BracketSide {
  return { label: entry.line.teamName, seed: entry.seed, owner: entry.line.owner, teamName: entry.line.teamName, score: null };
}

function playGame(
  id: BracketGame["id"], round: BracketGame["round"], week: number, title: string,
  a: SeedEntry, b: SeedEntry, rows: readonly ResultRow[],
): BracketGame {
  // The better seed is the home team and is listed first.
  const [hi, lo] = a.seed < b.seed ? [a, b] : [b, a];
  const top = seedSide(hi);
  const bottom = seedSide(lo);
  const row = rows.find(r => r.week === week
    && ((r.home_owner === hi.line.owner && r.away_owner === lo.line.owner) || (r.home_owner === lo.line.owner && r.away_owner === hi.line.owner)));
  let final = false;
  let winnerSeed: number | null = null;
  if (row) {
    const scoreOf = (owner: string) => num(row.home_owner === owner ? row.home_score : row.away_score);
    top.score = scoreOf(hi.line.owner);
    bottom.score = scoreOf(lo.line.owner);
    final = row.is_final;
    if (final) winnerSeed = bottom.score > top.score ? lo.seed : hi.seed; // a tie goes to the better seed
  }
  return { id, round, week, title, top, bottom, final, winnerSeed };
}

/** The playoff bracket for six seeds, filled in as results come in. */
export function buildBracket(seeds: readonly SeedEntry[], rows: readonly ResultRow[]): BracketGame[] {
  if (seeds.length < 6) return [];
  const s = (n: number) => seeds[n - 1];
  const wc1 = playGame("wc1", "wildcard", 15, "Wild Card 1", s(3), s(6), rows);
  const wc2 = playGame("wc2", "wildcard", 15, "Wild Card 2", s(4), s(5), rows);

  const winnerOf = (game: BracketGame): SeedEntry | null =>
    game.winnerSeed === null ? null : s(game.winnerSeed);

  const w1 = winnerOf(wc1);
  const w2 = winnerOf(wc2);
  let sf1: BracketGame;
  let sf2: BracketGame;
  if (w1 && w2) {
    // The top seed plays the lowest remaining seed (the bigger seed number).
    const [lower, higher] = w1.seed > w2.seed ? [w1, w2] : [w2, w1];
    sf1 = playGame("sf1", "semifinal", 16, "Semifinal 1", s(1), lower, rows);
    sf2 = playGame("sf2", "semifinal", 16, "Semifinal 2", s(2), higher, rows);
  } else {
    const pending = (id: "sf1" | "sf2", title: string, top: SeedEntry, label: string): BracketGame => ({
      id, round: "semifinal", week: 16, title,
      top: seedSide(top), bottom: unknownSide(label), final: false, winnerSeed: null,
    });
    sf1 = pending("sf1", "Semifinal 1", s(1), "Lowest remaining seed");
    sf2 = pending("sf2", "Semifinal 2", s(2), "Other wild card winner");
  }

  const f1 = winnerOf(sf1);
  const f2 = winnerOf(sf2);
  const finalGame: BracketGame = f1 && f2
    ? playGame("final", "final", 17, "Championship", f1, f2, rows)
    : { id: "final", round: "final", week: 17, title: "Championship",
        top: f1 ? seedSide(f1) : unknownSide("Winner of Semifinal 1"),
        bottom: f2 ? seedSide(f2) : unknownSide("Winner of Semifinal 2"),
        final: false, winnerSeed: null };
  return [wc1, wc2, sf1, sf2, finalGame];
}
