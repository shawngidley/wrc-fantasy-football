/**
 * WRC Fantasy Football — 2026 Season Schedule
 * Regular Season: Weeks 1–14
 * Playoffs: Week 15 (Wild Card), Week 16 (Divisional), Week 17 (Super Bowl)
 *
 * Owner → Team Name mapping:
 *   Jonas     → Jonas Pattie
 *   David R.  → The Boys of Fall
 *   Jason     → Heiden's Hardtimes
 *   Keith     → Keith Cromer
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

export interface ScheduleWeek {
  week: number;
  label: string;       // e.g. "Week 1", "Wild Card", "Super Bowl"
  dates: string;       // e.g. "Sept. 9–14"
  type: "regular" | "wildcard" | "divisional" | "superbowl";
  matchups: MatchupPair[];
}

/** Map owner first-name key → full team name */
export const OWNER_TO_TEAM: Record<string, string> = {
  "Jonas":    "Jonas Pattie",
  "David R.": "The Boys of Fall",
  "Jason":    "Heiden's Hardtimes",
  "Keith":    "Keith Cromer",
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
export function getCurrentWeek(): number {
  const now = Date.now();
  const weekDates: [number, number][] = [
    [new Date("2026-09-09").getTime(), new Date("2026-09-15").getTime()],
    [new Date("2026-09-17").getTime(), new Date("2026-09-22").getTime()],
    [new Date("2026-09-24").getTime(), new Date("2026-09-29").getTime()],
    [new Date("2026-10-01").getTime(), new Date("2026-10-06").getTime()],
    [new Date("2026-10-08").getTime(), new Date("2026-10-13").getTime()],
    [new Date("2026-10-15").getTime(), new Date("2026-10-20").getTime()],
    [new Date("2026-10-22").getTime(), new Date("2026-10-27").getTime()],
    [new Date("2026-10-29").getTime(), new Date("2026-11-03").getTime()],
    [new Date("2026-11-05").getTime(), new Date("2026-11-10").getTime()],
    [new Date("2026-11-12").getTime(), new Date("2026-11-17").getTime()],
    [new Date("2026-11-19").getTime(), new Date("2026-11-24").getTime()],
    [new Date("2026-11-25").getTime(), new Date("2026-12-01").getTime()],
    [new Date("2026-12-03").getTime(), new Date("2026-12-08").getTime()],
    [new Date("2026-12-10").getTime(), new Date("2026-12-15").getTime()],
    [new Date("2026-12-17").getTime(), new Date("2026-12-22").getTime()],
    [new Date("2026-12-24").getTime(), new Date("2026-12-29").getTime()],
    [new Date("2026-12-31").getTime(), new Date("2027-01-05").getTime()],
  ];
  for (let i = 0; i < weekDates.length; i++) {
    if (now >= weekDates[i][0] && now <= weekDates[i][1]) return i + 1;
  }
  // Before season starts → week 1; after season ends → week 17
  if (now < weekDates[0][0]) return 1;
  return 17;
}
