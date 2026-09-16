/**
 * WRC Fantasy Football — 2026 Season Schedule
 * Regular Season: Weeks 1–14
 * Playoffs: Week 15 (Wild Card), Week 16 (Divisional), Week 17 (Super Bowl)
 *
 * Owner → Team Name mapping:
 *   Jonas     → The Super Snuffleupagus
 *   David R.  → The Boys of Fall
 *   Jason     → Heiden's Hardtimes
 *   Keith     → HamSandwich
 *   Dan       → Legion of Doom
 *   Scott N.  → Millertime
 *   Bill      → Billy Goats Gruff
 *   Jamie     → The Four Horsemen
 *   Scott M.  → Xavier Musketeers
 *   David S.  → Legends
 *   Shawn     → Vipers
 *   Greg      → Larry "Bud" Melman123
 */

export type MatchupPair = [string, string]; // [home/left owner, away/right owner]

/** Per-matchup result keyed by "week-ownerA-ownerB" (alphabetical owners) */
export interface MatchupResult {
  week: number;
  ownerA: string; // left/home owner key
  ownerB: string; // right/away owner key
  scoreA: number;
  scoreB: number;
}

/**
 * 2026 season results — populate as weeks complete.
 * ownerA/ownerB match the owner keys in SCHEDULE_2026 matchups (left = ownerA).
 * Scores are fantasy points to one decimal.
 */
export const RESULTS_2026: MatchupResult[] = [
  // Example (replace with real scores each week):
  // { week: 1, ownerA: "Jonas", ownerB: "Keith", scoreA: 138.4, scoreB: 112.6 },
];

/** Look up the result for a specific matchup pair in a given week */
export function getResult(week: number, ownerA: string, ownerB: string): MatchupResult | null {
  return RESULTS_2026.find(
    r => r.week === week &&
      ((r.ownerA === ownerA && r.ownerB === ownerB) ||
       (r.ownerA === ownerB && r.ownerB === ownerA))
  ) ?? null;
}

/**
 * Derive playoff seeds from live standings data.
 * Format: 3 division winners (seeds 1-3) + 3 wild cards (seeds 4-6).
 * Division winner = best record in division (tiebreak: ptsFor).
 * Wild cards = best remaining records league-wide.
 *
 * Returns array of 6 team names in seed order [1..6].
 */
export interface StandingsTeam {
  teamName: string;
  owner: string;
  division: string;
  wins: number;
  losses: number;
  ptsFor: number;
}

export function derivePlayoffSeeds(teams: StandingsTeam[]): string[] {
  const divs = ["East", "Central", "West"] as const;
  const divWinners: StandingsTeam[] = [];
  const nonWinners: StandingsTeam[] = [];

  for (const div of divs) {
    const divTeams = teams
      .filter(t => t.division === div)
      .sort((a, b) => b.wins - a.wins || b.ptsFor - a.ptsFor);
    if (divTeams.length > 0) {
      divWinners.push(divTeams[0]);
      nonWinners.push(...divTeams.slice(1));
    }
  }

  // Sort division winners by record (for seeding 1-3)
  divWinners.sort((a, b) => b.wins - a.wins || b.ptsFor - a.ptsFor);

  // Wild cards: best 3 non-winners by record
  const wildCards = nonWinners
    .sort((a, b) => b.wins - a.wins || b.ptsFor - a.ptsFor)
    .slice(0, 3);

  return [...divWinners, ...wildCards].map(t => t.teamName);
}

export interface ScheduleWeek {
  week: number;
  label: string;       // e.g. "Week 1", "Wild Card", "Super Bowl"
  dates: string;       // e.g. "Sept. 9–14"
  type: "regular" | "wildcard" | "divisional" | "superbowl";
  matchups: MatchupPair[];
}

/** Map owner first-name key → full team name */
export const OWNER_TO_TEAM: Record<string, string> = {
  "Jonas":    "The Super Snuffleupagus",
  "David R.": "The Boys of Fall",
  "Jason":    "Heiden's Hardtimes",
  "Keith":    "HamSandwich",
  "Dan":      "Legion of Doom",
  "Scott N.": "Millertime",
  "Bill":     "Billy Goats Gruff",
  "Jamie":    "The Four Horsemen",
  "Scott M.": "Xavier Musketeers",
  "David S.": "Legends",
  "Shawn":    "Vipers",
  "Greg":     'Larry "Bud" Melman123',
};

export const SCHEDULE_2026: ScheduleWeek[] = [
  {
    week: 1,
    label: "Week 1",
    dates: "Sept. 9–14",
    type: "regular",
    matchups: [
      ["Jonas",    "Keith"],
      ["David R.", "Jason"],
      ["Jamie",    "Dan"],
      ["Bill",     "Scott N."],
      ["Shawn",    "Scott M."],
      ["David S.", "Greg"],
    ],
  },
  {
    week: 2,
    label: "Week 2",
    dates: "Sept. 17–21",
    type: "regular",
    matchups: [
      ["Jonas",    "Scott N."],
      ["David R.", "Bill"],
      ["Jason",    "Shawn"],
      ["Keith",    "David S."],
      ["Dan",      "Scott M."],
      ["Jamie",    "Greg"],
    ],
  },
  {
    week: 3,
    label: "Week 3",
    dates: "Sept. 24–28",
    type: "regular",
    matchups: [
      ["Jonas",    "Jamie"],
      ["David R.", "Scott N."],
      ["Jason",    "David S."],
      ["Keith",    "Scott M."],
      ["Dan",      "Greg"],
      ["Bill",     "Shawn"],
    ],
  },
  {
    week: 4,
    label: "Week 4",
    dates: "Oct. 1–5",
    type: "regular",
    matchups: [
      ["Jonas",    "Jason"],
      ["David R.", "Keith"],
      ["Jamie",    "Bill"],
      ["Dan",      "Scott N."],
      ["Shawn",    "David S."],
      ["Scott M.", "Greg"],
    ],
  },
  {
    week: 5,
    label: "Week 5",
    dates: "Oct. 8–12",
    type: "regular",
    matchups: [
      ["Jonas",    "David R."],
      ["Jason",    "Keith"],
      ["Jamie",    "Scott N."],
      ["Dan",      "Bill"],
      ["Shawn",    "Greg"],
      ["David S.", "Scott M."],
    ],
  },
  {
    week: 6,
    label: "Week 6",
    dates: "Oct. 15–19",
    type: "regular",
    matchups: [
      ["Jonas",    "Scott M."],
      ["David R.", "Shawn"],
      ["Jason",    "Bill"],
      ["Keith",    "Jamie"],
      ["Dan",      "David S."],
      ["Scott N.", "Greg"],
    ],
  },
  {
    week: 7,
    label: "Week 7",
    dates: "Oct. 22–26",
    type: "regular",
    matchups: [
      ["Jonas",    "Bill"],
      ["David R.", "Jamie"],
      ["Jason",    "Scott M."],
      ["Keith",    "Greg"],
      ["Dan",      "Shawn"],
      ["Scott N.", "David S."],
    ],
  },
  {
    week: 8,
    label: "Week 8",
    dates: "Oct. 29–Nov. 2",
    type: "regular",
    matchups: [
      ["Jonas",    "Greg"],
      ["David R.", "David S."],
      ["Jason",    "Jamie"],
      ["Keith",    "Dan"],
      ["Scott N.", "Shawn"],
      ["Bill",     "Scott M."],
    ],
  },
  {
    week: 9,
    label: "Week 9",
    dates: "Nov. 5–9",
    type: "regular",
    matchups: [
      ["Jonas",    "David R."],
      ["Jason",    "Keith"],
      ["Jamie",    "Scott N."],
      ["Dan",      "Bill"],
      ["Shawn",    "Greg"],
      ["David S.", "Scott M."],
    ],
  },
  {
    week: 10,
    label: "Week 10",
    dates: "Nov. 12–16",
    type: "regular",
    matchups: [
      ["Jonas",    "David S."],
      ["David R.", "Dan"],
      ["Jason",    "Greg"],
      ["Keith",    "Bill"],
      ["Jamie",    "Shawn"],
      ["Scott N.", "Scott M."],
    ],
  },
  {
    week: 11,
    label: "Week 11",
    dates: "Nov. 19–23",
    type: "regular",
    matchups: [
      ["Jonas",    "Shawn"],
      ["David R.", "Scott M."],
      ["Jason",    "Dan"],
      ["Keith",    "Scott N."],
      ["Jamie",    "David S."],
      ["Bill",     "Greg"],
    ],
  },
  {
    week: 12,
    label: "Week 12",
    dates: "Nov. 25–30",
    type: "regular",
    matchups: [
      ["Jonas",    "Jason"],
      ["David R.", "Keith"],
      ["Jamie",    "Bill"],
      ["Dan",      "Scott N."],
      ["Shawn",    "David S."],
      ["Scott M.", "Greg"],
    ],
  },
  {
    week: 13,
    label: "Week 13",
    dates: "Dec. 3–7",
    type: "regular",
    matchups: [
      ["Jonas",    "Dan"],
      ["David R.", "Greg"],
      ["Jason",    "Scott N."],
      ["Keith",    "Shawn"],
      ["Jamie",    "Scott M."],
      ["Bill",     "David S."],
    ],
  },
  {
    week: 14,
    label: "Week 14",
    dates: "Dec. 10–14",
    type: "regular",
    matchups: [
      ["Jonas",    "Keith"],
      ["David R.", "Jason"],
      ["Jamie",    "Dan"],
      ["Bill",     "Scott N."],
      ["Shawn",    "Scott M."],
      ["David S.", "Greg"],
    ],
  },
  {
    week: 15,
    label: "Wild Card",
    dates: "Dec. 17–21",
    type: "wildcard",
    matchups: [
      ["TBD", "TBD"],
      ["TBD", "TBD"],
    ],
  },
  {
    week: 16,
    label: "Divisional",
    dates: "Dec. 24–28",
    type: "divisional",
    matchups: [
      ["TBD", "TBD"],
      ["TBD", "TBD"],
    ],
  },
  {
    week: 17,
    label: "Super Bowl",
    dates: "Dec. 31–Jan. 4",
    type: "superbowl",
    matchups: [
      ["TBD", "TBD"],
    ],
  },
];

/** Returns the team name for a given owner key, or the key itself if not found */
export function ownerToTeam(owner: string): string {
  return OWNER_TO_TEAM[owner] ?? owner;
}

/** Returns the current week number (1-17) based on today's date */
// Each entry's start date is what actually matters for determining the
// current fantasy week -- once a week's games have begun, that week
// stays "current" through the gap before the next week's games start
// (e.g. the Tuesday/Wednesday between Monday Night Football and
// Thursday Night Football), not just during its own listed range.
export const WEEK_START_TIMESTAMPS: number[] = [
  new Date("2026-09-09").getTime(),
  new Date("2026-09-17").getTime(),
  new Date("2026-09-24").getTime(),
  new Date("2026-10-01").getTime(),
  new Date("2026-10-08").getTime(),
  new Date("2026-10-15").getTime(),
  new Date("2026-10-22").getTime(),
  new Date("2026-10-29").getTime(),
  new Date("2026-11-05").getTime(),
  new Date("2026-11-12").getTime(),
  new Date("2026-11-19").getTime(),
  new Date("2026-11-25").getTime(),
  new Date("2026-12-03").getTime(),
  new Date("2026-12-10").getTime(),
  new Date("2026-12-17").getTime(),
  new Date("2026-12-24").getTime(),
  new Date("2026-12-31").getTime(),
];

export function getCurrentWeek(): number {
  const now = Date.now();
  const weekStarts = WEEK_START_TIMESTAMPS;
  if (now < weekStarts[0]) return 1; // before the season starts
  let current = 1;
  for (let i = 0; i < weekStarts.length; i++) {
    if (now >= weekStarts[i]) current = i + 1;
  }
  return current;
}

// 2026's DST end date (EDT -> EST), the first Sunday in November --
// needed to compute the correct UTC offset for "9am ET" on any given
// Tuesday cutoff below, since the season spans both.
const DST_END_2026 = new Date("2026-11-01T06:00:00Z").getTime(); // 2am ET Nov 1 2026, in UTC

/**
 * The Lineup page's own default week -- distinct from getCurrentWeek()
 * (which Live Scoring and Standings use unchanged). Advances to the next
 * week at 9am ET on the Tuesday before that week starts, not at the
 * week's own start date/time the way getCurrentWeek() does. For each
 * week's start date, finds the nearest Tuesday on or before it (handles
 * the season's two Wednesday-starting weeks -- 1 and 12, both apparent
 * holiday-schedule shifts -- correctly via day-of-week arithmetic,
 * landing on the Monday before those specifically, one day early, rather
 * than a fixed "always 2 days before" offset that would be wrong for
 * those two).
 */
export function getLineupDefaultWeek(now = new Date()): number {
  const nowMs = now.getTime();
  let current = 1;
  for (let i = 0; i < WEEK_START_TIMESTAMPS.length; i++) {
    const weekStart = new Date(WEEK_START_TIMESTAMPS[i]);
    const dayOfWeek = weekStart.getUTCDay(); // 0=Sun ... 2=Tue ... 6=Sat
    const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;
    const tuesdayMidnightUtc = WEEK_START_TIMESTAMPS[i] - daysSinceTuesday * 24 * 60 * 60 * 1000;
    const offsetHours = tuesdayMidnightUtc < DST_END_2026 ? 4 : 5; // EDT vs EST
    const cutoff = tuesdayMidnightUtc + (9 + offsetHours) * 60 * 60 * 1000; // 9am ET that Tuesday
    if (nowMs >= cutoff) current = i + 1;
  }
  return current;
}

/**
 * Resolves a team's opponent for a given week, by team name (since some
 * pages, like Lineup.tsx, identify teams by name rather than owner key).
 * Returns undefined when there's no matchup for this team that week
 * (e.g. a bye week in an odd-team setup, or a playoff week this team
 * isn't part of) -- callers should render nothing in that case, not an
 * error.
 */
export function resolveWeeklyOpponentTeamName(teamName: string | null | undefined, week: number): string | undefined {
  if (!teamName) return undefined;
  const ownerKey = Object.entries(OWNER_TO_TEAM).find(([, name]) => name === teamName)?.[0];
  if (!ownerKey) return undefined;
  const matchup = SCHEDULE_2026.find(w => w.week === week)?.matchups.find(m => m[0] === ownerKey || m[1] === ownerKey);
  if (!matchup) return undefined;
  const opponentOwnerKey = matchup[0] === ownerKey ? matchup[1] : matchup[0];
  return OWNER_TO_TEAM[opponentOwnerKey];
}

/**
 * Week 1's actual kickoff -- the point at which the 2026 season has
 * genuinely started and current-season stats exist to show. Single,
 * shared source for this threshold: previously duplicated locally in
 * Lineup.tsx (whose own comment claimed PlayerPage.tsx also had a copy,
 * which turned out not to actually exist -- rather than add a second,
 * real duplicate while fixing useNFLSeasonStats.ts's own need for this
 * same check, moved the one existing copy here instead).
 */
export const SEASON_2026_START = new Date("2026-09-09T00:00:00-04:00");

/** True once the 2026 season has actually started (Week 1's kickoff has
 * passed) -- the point after which "current season" stats should mean
 * 2026, not 2025's now-completed season. */
export function isSeason2026Underway(now = new Date()): boolean {
  return now >= SEASON_2026_START;
}

/** The season stat pages (Lineup, Free Agents) default to: 2026 once
 * underway, otherwise 2025 (the last completed season, since 2026 has
 * no stats yet). */
export function getDefaultStatsYear(now = new Date()): number {
  return isSeason2026Underway(now) ? 2026 : 2025;
}

export const AVAILABLE_STATS_YEARS = [2023, 2024, 2025, 2026];
