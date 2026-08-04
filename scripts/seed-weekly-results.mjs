import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://aquroadkdiltzsvahuff.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4'
);

const OWNER_TO_TEAM = {
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

// Division lookup for each owner
const OWNER_DIVISION = {
  "Jonas":    "East",
  "David R.": "East",
  "Jason":    "East",
  "Jamie":    "East",
  "Keith":    "Central",
  "Dan":      "Central",
  "Scott N.": "Central",
  "Bill":     "Central",
  "Scott M.": "West",
  "David S.": "West",
  "Shawn":    "West",
  "Greg":     "West",
};

const SCHEDULE = [
  { week: 1,  dates: "Sept. 9-14",    matchups: [["Jonas","Keith"],["David R.","Jason"],["Jamie","Dan"],["Bill","Scott N."],["Shawn","Scott M."],["David S.","Greg"]] },
  { week: 2,  dates: "Sept. 17-21",   matchups: [["Jonas","Scott N."],["David R.","Bill"],["Jason","Shawn"],["Keith","David S."],["Dan","Scott M."],["Jamie","Greg"]] },
  { week: 3,  dates: "Sept. 24-28",   matchups: [["Jonas","Jamie"],["David R.","Scott N."],["Jason","David S."],["Keith","Scott M."],["Dan","Greg"],["Bill","Shawn"]] },
  { week: 4,  dates: "Oct. 1-5",      matchups: [["Jonas","Jason"],["David R.","Keith"],["Jamie","Bill"],["Dan","Scott N."],["Shawn","David S."],["Scott M.","Greg"]] },
  { week: 5,  dates: "Oct. 8-12",     matchups: [["Jonas","David R."],["Jason","Keith"],["Jamie","Scott N."],["Dan","Bill"],["Shawn","Greg"],["David S.","Scott M."]] },
  { week: 6,  dates: "Oct. 15-19",    matchups: [["Jonas","Scott M."],["David R.","Shawn"],["Jason","Bill"],["Keith","Jamie"],["Dan","David S."],["Scott N.","Greg"]] },
  { week: 7,  dates: "Oct. 22-26",    matchups: [["Jonas","Bill"],["David R.","Jamie"],["Jason","Scott M."],["Keith","Greg"],["Dan","Shawn"],["Scott N.","David S."]] },
  { week: 8,  dates: "Oct. 29-Nov. 2",matchups: [["Jonas","Greg"],["David R.","David S."],["Jason","Jamie"],["Keith","Dan"],["Scott N.","Shawn"],["Bill","Scott M."]] },
  { week: 9,  dates: "Nov. 5-9",      matchups: [["Jonas","David R."],["Jason","Keith"],["Jamie","Scott N."],["Dan","Bill"],["Shawn","Greg"],["David S.","Scott M."]] },
  { week: 10, dates: "Nov. 12-16",    matchups: [["Jonas","David S."],["David R.","Dan"],["Jason","Greg"],["Keith","Bill"],["Jamie","Shawn"],["Scott N.","Scott M."]] },
  { week: 11, dates: "Nov. 19-23",    matchups: [["Jonas","Shawn"],["David R.","Scott M."],["Jason","Dan"],["Keith","Scott N."],["Jamie","David S."],["Bill","Greg"]] },
  { week: 12, dates: "Nov. 25-30",    matchups: [["Jonas","Jason"],["David R.","Keith"],["Jamie","Bill"],["Dan","Scott N."],["Shawn","David S."],["Scott M.","Greg"]] },
  { week: 13, dates: "Dec. 3-7",      matchups: [["Jonas","Dan"],["David R.","Greg"],["Jason","Scott N."],["Keith","Shawn"],["Jamie","Scott M."],["Bill","David S."]] },
  { week: 14, dates: "Dec. 10-14",    matchups: [["Jonas","Keith"],["David R.","Jason"],["Jamie","Dan"],["Bill","Scott N."],["Shawn","Scott M."],["David S.","Greg"]] },
];

// First check if already seeded
const { data: existing } = await sb.from('weekly_results').select('id').limit(1);
if (existing && existing.length > 0) {
  console.log('weekly_results already has rows — skipping seed');
  process.exit(0);
}

const rows = [];
for (const week of SCHEDULE) {
  for (const [homeOwner, awayOwner] of week.matchups) {
    rows.push({
      week: week.week,
      season: 2026,
      home_owner: homeOwner,
      away_owner: awayOwner,
      home_team_name: OWNER_TO_TEAM[homeOwner],
      away_team_name: OWNER_TO_TEAM[awayOwner],
      home_score: null,
      away_score: null,
      is_final: false,
      league_median: null,
      dates: week.dates,
    });
  }
}

const { error } = await sb.from('weekly_results').insert(rows);
if (error) {
  console.error('Insert error:', error.message);
} else {
  console.log(`Seeded ${rows.length} matchup rows (${SCHEDULE.length} weeks × 6 matchups)`);
}
