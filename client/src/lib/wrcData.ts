/**
 * WRC Fantasy Football — Real League Data (2026 Season)
 * Source: WRCFootballFolder(2025).xlsx
 *
 * 12 Teams across 3 divisions (East / Central / West)
 */

export type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface RosterPlayer {
  id: string;
  name: string;
  pos: Pos;
  nflTeam: string;
  byeWeek: number | null;
  acquisition: "Draft" | "FA";
  round?: number | null; // draft round (1-18), null/undefined = FA
}

export interface TeamRecord {
  id: string;
  owner: string;
  teamName: string;
  division: "East" | "Central" | "West";
  wins: number;
  losses: number;
  ptsFor: number;
  ptsAgainst: number;
  clinched: null | "playoff" | null;
  pin: string;
  faabRemaining: number;
  is_commissioner?: boolean;
  players: RosterPlayer[];
}

// ── Player builder ─────────────────────────────────────────────────────────────
let _pid = 0;
function p(name: string, pos: Pos, nflTeam: string, bye: number | null, acq: "Draft" | "FA"): RosterPlayer {
  return { id: `p${++_pid}`, name, pos, nflTeam, byeWeek: bye, acquisition: acq };
}

// ── Teams ─────────────────────────────────────────────────────────────────────
export const TEAMS: TeamRecord[] = [
  // ── EAST ──────────────────────────────────────────────────────────────────
  {
    id: "jonas",
    owner: "Jonas",
    teamName: "The Super Snuffleupagus",
    division: "East",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Jared Goff",           "QB",  "DET", 7,    "Draft"),
      p("Bryce Young",          "QB",  "CAR", null, "FA"),
      p("Jonathan Taylor",      "RB",  "IND", 5,    "Draft"),
      p("De'Von Achane",        "RB",  "MIA", 6,    "Draft"),
      p("Aaron Jones",          "RB",  "MIN", 8,    "Draft"),
      p("Quinshon Judkins",     "RB",  "CLE", 9,    "Draft"),
      p("Trey Benson",          "RB",  "ARZ", 11,   "Draft"),
      p("Justin Jefferson",     "WR",  "MIN", 1,    "Draft"),
      p("Marvin Harrison Jr.",  "WR",  "ARZ", 2,    "Draft"),
      p("DK Metcalf",           "WR",  "PIT", 4,    "Draft"),
      p("Jakobi Meyers",        "WR",  "JAC", 10,   "Draft"),
      p("Jerry Jeudy",          "WR",  "CLE", null, "FA"),
      p("Darren Waller",        "TE",  "MIA", 18,   "Draft"),
      p("Juwan Johnson",        "TE",  "NO",  null, "FA"),
      p("Sam LaPorta",          "TE",  "DET", null, "FA"),
      p("Chase McLaughlin",     "K",   "TAM", null, "FA"),
      p("Cleveland Browns",     "DST", "CLE", 17,   "Draft"),
      p("Los Angeles Chargers", "DST", "LAC", null, "FA"),
    ],
  },
  {
    id: "davidr",
    owner: "David R.",
    teamName: "The Boys of Fall",
    division: "East",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Bo Nix",               "QB",  "DEN", 6,    "Draft"),
      p("Jaxson Dart",          "QB",  "NYG", null, "FA"),
      p("Alvin Kamara",         "RB",  "NO",  3,    "Draft"),
      p("Travis Etienne",       "RB",  "JAC", 8,    "Draft"),
      p("Dylan Sampson",        "RB",  "CLE", null, "FA"),
      p("Devin Singletary",     "RB",  "NYG", null, "FA"),
      p("Jameson Williams",     "WR",  "DET", 5,    "Draft"),
      p("Chris Olave",          "WR",  "NO",  8,    "Draft"),
      p("Christian Kirk",       "WR",  "HOU", 14,   "Draft"),
      p("Marquise Brown",       "WR",  "KAN", 17,   "Draft"),
      p("Wan'Dale Robinson",    "WR",  "NYG", 18,   "Draft"),
      p("Quentin Johnston",     "WR",  "LAC", null, "FA"),
      p("George Kittle",        "TE",  "SF",  4,    "Draft"),
      p("Tyler Warren",         "TE",  "IND", 7,    "Draft"),
      p("AJ Barner",            "TE",  "SEA", null, "FA"),
      p("Eddy Pineiro",         "K",   "SF",  null, "FA"),
      p("Joey Slye",            "K",   "CAR", null, "FA"),
      p("Dallas Cowboys",       "DST", "DAL", null, "FA"),
    ],
  },
  {
    id: "jason",
    owner: "Jason",
    teamName: "Heiden's Hardtimes",
    division: "East",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Justin Herbert",       "QB",  "LAC", 6,    "Draft"),
      p("Kyler Murray",         "QB",  "ARZ", 6,    "Draft"),
      p("Matthew Stafford",     "QB",  "LAR", 17,   "Draft"),
      p("Saquon Barkley",       "RB",  "PHI", 1,    "Draft"),
      p("Omarion Hampton",      "RB",  "LAC", 2,    "Draft"),
      p("TreVeyon Henderson",   "RB",  "NE",  2,    "Draft"),
      p("Kimani Vidal",         "RB",  "LAC", null, "FA"),
      p("Terry McLaurin",       "WR",  "WAS", 2,    "Draft"),
      p("Emeka Egbuka",         "WR",  "TAM", 5,    "Draft"),
      p("Michael Pittman",      "WR",  "IND", 8,    "Draft"),
      p("Jordan Addison",       "WR",  "MIN", 10,   "Draft"),
      p("Stefon Diggs",         "WR",  "NE",  12,   "Draft"),
      p("T.J. Hockenson",       "TE",  "MIN", 6,    "Draft"),
      p("Dalton Schultz",       "TE",  "HOU", null, "FA"),
      p("Jake Bates",           "K",   "DET", null, "FA"),
      p("Joshua Karty",         "K",   "LAR", null, "FA"),
      p("Detroit Lions",        "DST", "DET", 13,   "Draft"),
      p("San Francisco 49ers",  "DST", "SF",  null, "FA"),
    ],
  },
  // ── CENTRAL ───────────────────────────────────────────────────────────────
  {
    id: "keith",
    owner: "Keith",
    teamName: "HamSandwich",
    division: "Central",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Jordan Love",          "QB",  "GB",  9,    "Draft"),
      p("Tyler Shough",         "QB",  "NO",  null, "FA"),
      p("Ashton Jeanty",        "RB",  "LV",  1,    "Draft"),
      p("Jahmyr Gibbs",         "RB",  "DET", 2,    "Draft"),
      p("Kyle Monangai",        "RB",  "CHI", null, "FA"),
      p("Chuba Hubbard",        "RB",  "CAR", null, "FA"),
      p("Davante Adams",        "WR",  "LAR", 3,    "Draft"),
      p("Rome Odunze",          "WR",  "CHI", 5,    "Draft"),
      p("Ladd McConkey",        "WR",  "LAC", 6,    "Draft"),
      p("Jayden Reed",          "WR",  "GB",  null, "FA"),
      p("Chris Godwin",         "WR",  "TAM", null, "FA"),
      p("Brock Bowers",         "TE",  "LV",  4,    "Draft"),
      p("Theo Johnson",         "TE",  "NYG", null, "FA"),
      p("Colston Loveland",     "TE",  "CHI", null, "FA"),
      p("Brenton Strange",      "TE",  "JAC", null, "FA"),
      p("Chris Boswell",        "K",   "PIT", null, "FA"),
      p("Seattle Seahawks",     "DST", "SEA", 17,   "Draft"),
      p("New England Patriots", "DST", "NE",  null, "FA"),
    ],
  },
  {
    id: "dan",
    owner: "Dan",
    teamName: "Legion of Doom",
    division: "Central",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Dak Prescott",         "QB",  "DAL", 5,    "Draft"),
      p("Brock Purdy",          "QB",  "SF",  9,    "Draft"),
      p("Trevor Lawrence",      "QB",  "JAC", 10,   "Draft"),
      p("Derrick Henry",        "RB",  "BAL", 1,    "Draft"),
      p("Tony Pollard",         "RB",  "TEN", 3,    "Draft"),
      p("Christian McCaffrey",  "RB",  "SF",  6,    "Draft"),
      p("Brian Robinson",       "RB",  "SF",  11,   "Draft"),
      p("Justice Hill",         "RB",  "BAL", 16,   "Draft"),
      p("Amon-Ra St. Brown",    "WR",  "DET", 1,    "Draft"),
      p("A.J. Brown",           "WR",  "PHI", 2,    "Draft"),
      p("Xavier Worthy",        "WR",  "KAN", 4,    "Draft"),
      p("George Pickens",       "WR",  "DAL", 8,    "Draft"),
      p("Jauan Jennings",       "WR",  "SF",  11,   "Draft"),
      p("Adonai Mitchell",      "WR",  "NYJ", null, "FA"),
      p("Mark Andrews",         "TE",  "BAL", 5,    "Draft"),
      p("Hunter Henry",         "TE",  "NE",  14,   "Draft"),
      p("Tyler Loop",           "K",   "BAL", null, "FA"),
      p("Chicago Bears",        "DST", "CHI", null, "FA"),
    ],
  },
  {
    id: "scottn",
    owner: "Scott N.",
    teamName: "Millertime",
    division: "Central",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Lamar Jackson",        "QB",  "BAL", 2,    "Draft"),
      p("Daniel Jones",         "QB",  "IND", null, "FA"),
      p("Josh Jacobs",          "RB",  "GB",  1,    "Draft"),
      p("Isiah Pacheco",        "RB",  "KAN", 3,    "Draft"),
      p("Kyren Williams",       "RB",  "LAR", 5,    "Draft"),
      p("Rhamondre Stevenson",  "RB",  "NE",  13,   "Draft"),
      p("Tyjae Spears",         "RB",  "TEN", 15,   "Draft"),
      p("Emanuel Wilson",       "RB",  "GB",  null, "FA"),
      p("Garrett Wilson",       "WR",  "NYJ", 4,    "Draft"),
      p("Nico Collins",         "WR",  "HOU", 6,    "Draft"),
      p("Jaxon Smith-Njigba",   "WR",  "SEA", 7,    "Draft"),
      p("Jaylen Waddle",        "WR",  "MIA", 8,    "Draft"),
      p("Andrei Iosivas",       "WR",  "CIN", null, "FA"),
      p("Kyle Pitts",           "TE",  "ATL", 12,   "Draft"),
      p("Oronde Gadsden",       "TE",  "LAC", null, "FA"),
      p("Evan McPherson",       "K",   "CIN", null, "FA"),
      p("Kansas City Chiefs",   "DST", "KAN", null, "FA"),
      p("Houston Texans",       "DST", "HOU", null, "FA"),
    ],
  },
  {
    id: "bill",
    owner: "Bill",
    teamName: "Billy Goats Gruff",
    division: "Central",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Jayden Daniels",       "QB",  "WAS", 3,    "Draft"),
      p("Drake Maye",           "QB",  "NE",  8,    "Draft"),
      p("Shedeur Sanders",      "QB",  "CLE", null, "FA"),
      p("Jordan Mason",         "RB",  "MIN", 7,    "Draft"),
      p("Cam Skattebo",         "RB",  "NYG", 9,    "Draft"),
      p("Kenneth Gainwell",     "RB",  "PIT", null, "FA"),
      p("Tyrone Tracy",         "RB",  "NYG", null, "FA"),
      p("D.J. Moore",           "WR",  "CHI", 4,    "Draft"),
      p("Keenan Allen",         "WR",  "LAC", 15,   "Draft"),
      p("Malik Nabers",         "WR",  "NYG", null, "FA"),
      p("Rashid Shaheed",       "WR",  "SEA", null, "FA"),
      p("Xavier Legette",       "WR",  "CAR", null, "FA"),
      p("David Njoku",          "TE",  "CLE", 4,    "Draft"),
      p("Zach Ertz",            "TE",  "WAS", 13,   "Draft"),
      p("Cade Otton",           "TE",  "TB",  null, "FA"),
      p("Brandon Aubrey",       "K",   "DAL", 10,   "Draft"),
      p("Will Reichard",        "K",   "MIN", null, "FA"),
      p("Los Angeles Rams",     "DST", "LAR", null, "FA"),
    ],
  },
  // ── WEST ──────────────────────────────────────────────────────────────────
  {
    id: "jamie",
    owner: "Jamie",
    teamName: "The Four Horsemen",
    division: "East",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Jalen Hurts",          "QB",  "PHI", 2,    "Draft"),
      p("Tua Tagovailoa",       "QB",  "MIA", null, "FA"),
      p("Tyrod Taylor",         "QB",  "NYJ", null, "FA"),
      p("Jaylen Warren",        "RB",  "PIT", 5,    "Draft"),
      p("Chase Brown",          "RB",  "CIN", 7,    "Draft"),
      p("Ollie Gordon",         "RB",  "MIA", 12,   "Draft"),
      p("DJ Giddens",           "RB",  "IND", 16,   "Draft"),
      p("CeeDee Lamb",          "WR",  "DAL", 1,    "Draft"),
      p("Drake London",         "WR",  "ATL", 1,    "Draft"),
      p("Jalen Coker",          "WR",  "CAR", 15,   "Draft"),
      p("Troy Franklin",        "WR",  "DEN", null, "FA"),
      p("Michael Wilson",       "WR",  "ARZ", null, "FA"),
      p("Brandon Aiyuk",        "WR",  "SF",  null, "FA"),
      p("Travis Kelce",         "TE",  "KAN", 4,    "Draft"),
      p("Cameron Dicker",       "K",   "LAC", 11,   "Draft"),
      p("Andres Borregales",    "K",   "NE",  null, "FA"),
      p("Denver Broncos",       "DST", "DEN", 11,   "Draft"),
      p("Jacksonville Jaguars", "DST", "JAC", null, "FA"),
    ],
  },
  {
    id: "scottm",
    owner: "Scott M.",
    teamName: "Xavier Musketeers",
    division: "West",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Caleb Williams",       "QB",  "CHI", 9,    "Draft"),
      p("Sam Darnold",          "QB",  "SEA", 15,   "Draft"),
      p("Bijan Robinson",       "RB",  "ATL", 1,    "Draft"),
      p("James Cook",           "RB",  "BUF", 3,    "Draft"),
      p("Tyler Allgeier",       "RB",  "ATL", 12,   "Draft"),
      p("Ray Davis",            "RB",  "BUF", 13,   "Draft"),
      p("Blake Corum",          "RB",  "LAR", 18,   "Draft"),
      p("Zonovan Knight",       "RB",  "ARZ", null, "FA"),
      p("Tee Higgins",          "WR",  "CIN", 1,    "Draft"),
      p("DeVonta Smith",        "WR",  "PHI", 5,    "Draft"),
      p("Kayshon Boutte",       "WR",  "NE",  null, "FA"),
      p("Parker Washington",    "WR",  "JAC", null, "FA"),
      p("Christian Watson",     "WR",  "GB",  null, "FA"),
      p("Evan Engram",          "TE",  "DEN", 7,    "Draft"),
      p("Dallas Goedert",       "TE",  "PHI", 16,   "Draft"),
      p("Jason Myers",          "K",   "SEA", null, "FA"),
      p("Pittsburgh Steelers",  "DST", "PIT", 10,   "Draft"),
      p("Buffalo Bills",        "DST", "BUF", null, "FA"),
    ],
  },
  {
    id: "davids",
    owner: "David S.",
    teamName: "Legends",
    division: "West",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("Josh Allen",           "QB",  "BUF", 1,    "Draft"),
      p("Patrick Mahomes",      "QB",  "KAN", 4,    "Draft"),
      p("Breece Hall",          "RB",  "NYJ", 3,    "Draft"),
      p("RJ Harvey",            "RB",  "DEN", 3,    "Draft"),
      p("David Montgomery",     "RB",  "DET", 7,    "Draft"),
      p("Bucky Irving",         "RB",  "TB",  8,    "Draft"),
      p("Rachaad White",        "RB",  "TAM", 16,   "Draft"),
      p("Kareem Hunt",          "RB",  "KAN", null, "FA"),
      p("Ja'Marr Chase",        "WR",  "CIN", 1,    "Draft"),
      p("Rashee Rice",          "WR",  "KAN", 5,    "Draft"),
      p("Puka Nacua",           "WR",  "LAR", 6,    "Draft"),
      p("Romeo Doubs",          "WR",  "GB",  15,   "Draft"),
      p("Dalton Kincaid",       "TE",  "BUF", 8,    "Draft"),
      p("Jake Ferguson",        "TE",  "DAL", 12,   "Draft"),
      p("Isaiah Likely",        "TE",  "BAL", null, "FA"),
      p("Cam Little",           "K",   "JAC", null, "FA"),
      p("Carolina Panthers",    "DST", "CAR", null, "FA"),
      p("New York Giants",      "DST", "NYG", null, "FA"),
    ],
  },
  {
    id: "shawn",
    owner: "Shawn",
    teamName: "Vipers",
    division: "West",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    is_commissioner: true,
    faabRemaining: 1000,
    players: [
      p("Baker Mayfield",           "QB",  "TAM", 6,    "Draft"),
      p("Jacoby Brissett",          "QB",  "ARZ", null, "FA"),
      p("D'Andre Swift",            "RB",  "CHI", 4,    "Draft"),
      p("Javonte Williams",         "RB",  "DAL", 8,    "Draft"),
      p("Woody Marks",              "RB",  "HOU", null, "FA"),
      p("Chris Rodriguez Jr.",      "RB",  "WAS", null, "FA"),
      p("Devin Neal",               "RB",  "NO",  null, "FA"),
      p("Jacory Croskey-Merritt",   "RB",  "WAS", null, "FA"),
      p("Courtland Sutton",         "WR",  "DEN", 3,    "Draft"),
      p("Ricky Pearsall",           "WR",  "SF",  5,    "Draft"),
      p("Khalil Shakir",            "WR",  "BUF", 12,   "Draft"),
      p("Alec Pierce",              "WR",  "IND", null, "FA"),
      p("Mike Evans",               "WR",  "TAM", null, "FA"),
      p("Trey McBride",             "TE",  "ARZ", 7,    "Draft"),
      p("Harold Fannin",            "TE",  "CLE", 16,   "Draft"),
      p("Ka'imi Fairbairn",         "K",   "HOU", null, "FA"),
      p("Green Bay Packers",        "DST", "GB",  15,   "Draft"),
      p("Tampa Bay Buccaneers",     "DST", "TB",  null, "FA"),
    ],
  },
  {
    id: "greg",
    owner: "Greg",
    teamName: "Larry \"Bud\" Melman123",
    division: "West",
    wins: 0, losses: 0, ptsFor: 0, ptsAgainst: 0,
    clinched: null,
    pin: "1234",
    faabRemaining: 1000,
    players: [
      p("C.J. Stroud",          "QB",  "HOU", 9,    "Draft"),
      p("Joe Burrow",           "QB",  "CIN", null, "FA"),
      p("Cam Ward",             "QB",  "TEN", null, "FA"),
      p("Kenneth Walker III",   "RB",  "SEA", 2,    "Draft"),
      p("Zach Charbonnet",      "RB",  "SEA", 9,    "Draft"),
      p("J.K. Dobbins",         "RB",  "DEN", 9,    "Draft"),
      p("Rico Dowdle",          "RB",  "CAR", 14,   "Draft"),
      p("Tetairoa McMillan",    "WR",  "CAR", 3,    "Draft"),
      p("Zay Flowers",          "WR",  "BAL", 4,    "Draft"),
      p("Brian Thomas Jr.",     "WR",  "JAC", 7,    "Draft"),
      p("Brandin Cooks",        "WR",  "BUF", 18,   "Draft"),
      p("Tucker Kraft",         "TE",  "GB",  7,    "Draft"),
      p("Jonnu Smith",          "TE",  "PIT", 12,   "Draft"),
      p("Chigoziem Okonkwo",    "TE",  "TEN", 14,   "Draft"),
      p("Jake Elliott",         "K",   "PHI", 13,   "Draft"),
      p("Cairo Santos",         "K",   "CHI", null, "FA"),
      p("Philadelphia Eagles",  "DST", "PHI", 10,   "Draft"),
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────
export const TEAM_MAP: Record<string, TeamRecord> = Object.fromEntries(
  TEAMS.map(t => [t.id, t])
);

export interface FlatPlayer extends RosterPlayer {
  ownerTeamId: string;
  ownerTeamName: string;
  ownerOwner: string;
}

export const ALL_PLAYERS: FlatPlayer[] = TEAMS.flatMap(t =>
  t.players.map(pl => ({
    ...pl,
    ownerTeamId: t.id,
    ownerTeamName: t.teamName,
    ownerOwner: t.owner,
  }))
);

// ── 2026 Draft Order (snake, 18 rounds) ───────────────────────────────────────
// Round 1 order from Excel: Greg(1) Shawn(2) Bill(3) David R.(4) Jason(5) Scott N.(6)
//                            David S.(7) Jonas(8) Jamie(9) Keith(10) Scott M.(11) Dan(12)
// Traded picks from Excel: Rd 8 pick 2 (Shawn) → Scott M.; Rd 8 pick 7 (Jason) → David S.
const ROUND1_ORDER = ["greg","shawn","bill","davidr","jason","scottn","davids","jonas","jamie","keith","scottm","dan"];

export interface DraftPick {
  round: number;
  pick: number;
  originalOwner: string;
  currentOwner: string;
  label: string;
}

function buildDraftOrder(): DraftPick[] {
  const picks: DraftPick[] = [];
  const tradedPicks: Record<string, Record<number, string>> = {
    "shawn": { 8: "scottm" },
    "jason": { 8: "davids" },
  };
  for (let round = 1; round <= 18; round++) {
    const order = round % 2 === 1 ? [...ROUND1_ORDER] : [...ROUND1_ORDER].reverse();
    order.forEach((teamId, i) => {
      const pick = i + 1;
      const currentOwner = tradedPicks[teamId]?.[round] ?? teamId;
      picks.push({ round, pick, originalOwner: teamId, currentOwner, label: `2026 Rd ${round} Pick ${pick}` });
    });
  }
  return picks;
}

export const DRAFT_PICKS_2026: DraftPick[] = buildDraftOrder();

export function getPicksForTeam(teamId: string): DraftPick[] {
  return DRAFT_PICKS_2026.filter(pk => pk.currentOwner === teamId);
}

export const CURRENT_WEEK = 14;
