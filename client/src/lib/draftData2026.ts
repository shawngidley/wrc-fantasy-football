/**
 * WRC Fantasy Football — 2026 Draft Order
 * Source: WRCFootballFolder(2025).xlsx — "2026 Draft Order" sheet
 *
 * Snake draft, 18 rounds × 12 teams = 216 total picks
 * Traded picks are noted with the original owner in parentheses
 * e.g. "Scott M. (Shawn)" means Scott M. holds a pick originally belonging to Shawn
 */

export interface DraftPick {
  overall: number;    // 1-based overall pick number
  round: number;
  pickInRound: number;
  owner: string;      // current owner (may differ from original if traded)
  originalOwner?: string; // set if the pick was traded
  player?: string;    // filled in after the pick is made
  pos?: string;
  nflTeam?: string;
  isTraded?: boolean;
}

// Map owner names to team IDs for cross-referencing
export const OWNER_TO_TEAM_ID: Record<string, string> = {
  "Greg":     "greg",
  "Shawn":    "shawn",
  "Bill":     "billy-goats",
  "David R.": "david-r",
  "Jason":    "jason",
  "Scott N.": "scott-n",
  "David S.": "david-s",
  "Jonas":    "jonas",
  "Jamie":    "jamie",
  "Keith":    "keith",
  "Scott M.": "scott-m",
  "Dan":      "dan",
};

// Parse "Owner (OriginalOwner)" notation
function parsePick(raw: string): { owner: string; originalOwner?: string } {
  const m = raw.match(/^(.+?)\s*\((.+?)\)$/);
  if (m) return { owner: m[1].trim(), originalOwner: m[2].trim() };
  return { owner: raw.trim() };
}

// Raw round data extracted from the Excel sheet
// Each entry: [pickInRound, ownerRaw]
// Round 1 (no pick numbers in sheet for first 6 slots — they are implied 1-6)
const RAW_ROUNDS: Array<{ round: number; picks: Array<[number, string]> }> = [
  {
    round: 1,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "David R. (Jamie)"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 2,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "David S."],
      [7,  "Scott N."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 3,
    picks: [
      [1,  "Greg"],
      [2,  "Scott M. (Shawn)"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "Greg (David S.)"],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 4,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 5,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 6,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "David S. (Greg)"],
    ],
  },
  {
    round: 7,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 8,
    picks: [
      [1,  "Dan"],
      [2,  "Shawn (Scott M.)"],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Jason (David S.)"],
      [7,  "Scott N."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 9,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 10,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Greg (David S.)"],
      [7,  "Scott N."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 11,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 12,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "David S."],
      [7,  "Scott N."],
      [8,  "David S. (Jason)"],
      [9,  "Jamie (David R.)"],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 13,
    picks: [
      [1,  "David S. (Greg)"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 14,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 15,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 16,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
  {
    round: 17,
    picks: [
      [1,  "Greg"],
      [2,  "Shawn"],
      [3,  "Bill"],
      [4,  "David R."],
      [5,  "Jason"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jonas"],
      [9,  "Jamie"],
      [10, "Keith"],
      [11, "Scott M."],
      [12, "Dan"],
    ],
  },
  {
    round: 18,
    picks: [
      [1,  "Dan"],
      [2,  "Scott M."],
      [3,  "Keith"],
      [4,  "Jamie"],
      [5,  "Jonas"],
      [6,  "Scott N."],
      [7,  "David S."],
      [8,  "Jason"],
      [9,  "David R."],
      [10, "Bill"],
      [11, "Shawn"],
      [12, "Greg"],
    ],
  },
];

// Build the flat picks array
let overallCounter = 0;
export const DRAFT_PICKS_2026: DraftPick[] = [];

for (const { round, picks } of RAW_ROUNDS) {
  for (const [pickInRound, ownerRaw] of picks) {
    overallCounter++;
    const { owner, originalOwner } = parsePick(ownerRaw);
    DRAFT_PICKS_2026.push({
      overall: overallCounter,
      round,
      pickInRound,
      owner,
      originalOwner,
      isTraded: !!originalOwner,
    });
  }
}

export const TOTAL_ROUNDS = 18;
export const TOTAL_TEAMS = 12;
export const TOTAL_PICKS = DRAFT_PICKS_2026.length;

// Get all picks for a given owner (current holder)
export function getPicksByOwner(owner: string): DraftPick[] {
  return DRAFT_PICKS_2026.filter(p => p.owner === owner);
}

// Get all traded picks (where current owner ≠ original owner)
export function getTradedPicks(): DraftPick[] {
  return DRAFT_PICKS_2026.filter(p => p.isTraded);
}
