/**
 * WRC Fantasy Football - Rosters Page
 * Background: Field turf
 * Shows all 12 franchise rosters at a glance — each team's 18 players
 * with position, NFL team, and starter/bench designation.
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

type Player = {
  name: string;
  pos: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nflTeam: string;
  isStarter?: boolean;
  // acquisition: "Rd 3" for draft pick, "FA $45" for FAAB waiver
  acq?: string;
};

// ── Sort helpers ─────────────────────────────────────────────────────────────
const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DST: 5 };

/**
 * Parse acquisition string into a numeric sort key:
 *   "Rd 3"  → 3          (draft round — lower is earlier / better)
 *   "FA $28" → -28        (FAAB — higher dollar = earlier pick, so negate)
 *   undefined → 9999      (no acq data — sort last)
 */
function acqSortKey(acq?: string): number {
  if (!acq) return 9999;
  if (acq.startsWith("Rd ")) {
    const round = parseInt(acq.replace("Rd ", ""), 10);
    return isNaN(round) ? 9999 : round;
  }
  if (acq.startsWith("FA $")) {
    const dollars = parseInt(acq.replace("FA $", ""), 10);
    // Negate so higher FAAB sorts first (lower sort key)
    return isNaN(dollars) ? 9999 : -dollars;
  }
  return 9999;
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const posDiff = (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99);
    if (posDiff !== 0) return posDiff;
    return acqSortKey(a.acq) - acqSortKey(b.acq);
  });
}

type Franchise = {
  id: string;
  teamName: string;
  owner: string;
  division: "East" | "Central" | "West";
  logo?: string;
  faabRemaining?: number;
  players: Player[];
};

const ROSTERS: Franchise[] = [
  // ── EAST ──────────────────────────────────────────────
  {
    id: "gidley", teamName: "Team Gidley", owner: "Shawn Gidley", division: "East", faabRemaining: 312,
    players: [
      { name: "Lamar Jackson", pos: "QB", nflTeam: "BAL", isStarter: true, acq: "Rd 1" },
      { name: "Derrick Henry", pos: "RB", nflTeam: "BAL", isStarter: true, acq: "Rd 2" },
      { name: "Breece Hall", pos: "RB", nflTeam: "NYJ", isStarter: true, acq: "Rd 3" },
      { name: "Ja'Marr Chase", pos: "WR", nflTeam: "CIN", isStarter: true, acq: "Rd 4" },
      { name: "Stefon Diggs", pos: "WR", nflTeam: "HOU", isStarter: true, acq: "Rd 5" },
      { name: "Sam LaPorta", pos: "TE", nflTeam: "DET", isStarter: true, acq: "Rd 6" },
      { name: "Josh Allen", pos: "QB", nflTeam: "BUF", isStarter: true, acq: "Rd 7" },
      { name: "Tony Pollard", pos: "RB", nflTeam: "TEN", isStarter: true, acq: "Rd 8" },
      { name: "Rashee Rice", pos: "WR", nflTeam: "KC", isStarter: true, acq: "Rd 9" },
      { name: "Harrison Butker", pos: "K", nflTeam: "KC", isStarter: true, acq: "Rd 15" },
      { name: "San Francisco 49ers", pos: "DST", nflTeam: "SF", isStarter: true, acq: "Rd 16" },
      { name: "Gus Edwards", pos: "RB", nflTeam: "LAC", acq: "FA $28" },
      { name: "Marquise Brown", pos: "WR", nflTeam: "KC", acq: "FA $14" },
      { name: "Trey McBride", pos: "TE", nflTeam: "ARI", acq: "Rd 10" },
      { name: "Jordan Love", pos: "QB", nflTeam: "GB", acq: "Rd 11" },
      { name: "Jaylen Warren", pos: "RB", nflTeam: "PIT", acq: "FA $7" },
      { name: "Dontayvion Wicks", pos: "WR", nflTeam: "GB", acq: "FA $3" },
      { name: "Evan McPherson", pos: "K", nflTeam: "CIN", acq: "Rd 17" },
    ],
  },
  {
    id: "sotka", teamName: "Team Sotka", owner: "David Sotka", division: "East", faabRemaining: 487,
    players: [
      { name: "Patrick Mahomes", pos: "QB", nflTeam: "KC", isStarter: true },
      { name: "Christian McCaffrey", pos: "RB", nflTeam: "SF", isStarter: true },
      { name: "Saquon Barkley", pos: "RB", nflTeam: "PHI", isStarter: true },
      { name: "Tyreek Hill", pos: "WR", nflTeam: "MIA", isStarter: true },
      { name: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", isStarter: true },
      { name: "Travis Kelce", pos: "TE", nflTeam: "KC", isStarter: true },
      { name: "Dak Prescott", pos: "QB", nflTeam: "DAL", isStarter: true },
      { name: "Rhamondre Stevenson", pos: "RB", nflTeam: "NE", isStarter: true },
      { name: "Davante Adams", pos: "WR", nflTeam: "NYJ", isStarter: true },
      { name: "Tyler Bass", pos: "K", nflTeam: "BUF", isStarter: true },
      { name: "Dallas Cowboys", pos: "DST", nflTeam: "DAL", isStarter: true },
      { name: "Rachaad White", pos: "RB", nflTeam: "TB" },
      { name: "Odell Beckham Jr.", pos: "WR", nflTeam: "MIA" },
      { name: "Dalton Kincaid", pos: "TE", nflTeam: "BUF" },
      { name: "Sam Howell", pos: "QB", nflTeam: "SEA" },
      { name: "Zack Moss", pos: "RB", nflTeam: "IND" },
      { name: "Darius Slayton", pos: "WR", nflTeam: "NYG" },
      { name: "Brandon Aubrey", pos: "K", nflTeam: "DAL" },
    ],
  },
  {
    id: "nelson", teamName: "Team Nelson", owner: "Scott Nelson", division: "East", faabRemaining: 155,
    players: [
      { name: "Jalen Hurts", pos: "QB", nflTeam: "PHI", isStarter: true },
      { name: "Jonathan Taylor", pos: "RB", nflTeam: "IND", isStarter: true },
      { name: "Josh Jacobs", pos: "RB", nflTeam: "GB", isStarter: true },
      { name: "Justin Jefferson", pos: "WR", nflTeam: "MIN", isStarter: true },
      { name: "Amon-Ra St. Brown", pos: "WR", nflTeam: "DET", isStarter: true },
      { name: "Dallas Goedert", pos: "TE", nflTeam: "PHI", isStarter: true },
      { name: "Anthony Richardson", pos: "QB", nflTeam: "IND", isStarter: true },
      { name: "Dameon Pierce", pos: "RB", nflTeam: "HOU", isStarter: true },
      { name: "Keenan Allen", pos: "WR", nflTeam: "CHI", isStarter: true },
      { name: "Jake Elliott", pos: "K", nflTeam: "PHI", isStarter: true },
      { name: "Philadelphia Eagles", pos: "DST", nflTeam: "PHI", isStarter: true },
      { name: "Ty Chandler", pos: "RB", nflTeam: "SF" },
      { name: "Jaxon Smith-Njigba", pos: "WR", nflTeam: "SEA" },
      { name: "Cade Otton", pos: "TE", nflTeam: "TB" },
      { name: "Will Levis", pos: "QB", nflTeam: "TEN" },
      { name: "Clyde Edwards-Helaire", pos: "RB", nflTeam: "KC" },
      { name: "Elijah Moore", pos: "WR", nflTeam: "CLE" },
      { name: "Cairo Santos", pos: "K", nflTeam: "CHI" },
    ],
  },
  {
    id: "yane", teamName: "Team Yane", owner: "James Yane", division: "East",
    players: [
      { name: "Tua Tagovailoa", pos: "QB", nflTeam: "MIA", isStarter: true },
      { name: "Tony Pollard", pos: "RB", nflTeam: "TEN", isStarter: true },
      { name: "David Montgomery", pos: "RB", nflTeam: "DET", isStarter: true },
      { name: "Puka Nacua", pos: "WR", nflTeam: "LAR", isStarter: true },
      { name: "Tee Higgins", pos: "WR", nflTeam: "CIN", isStarter: true },
      { name: "Jake Ferguson", pos: "TE", nflTeam: "DAL", isStarter: true },
      { name: "Baker Mayfield", pos: "QB", nflTeam: "TB", isStarter: true },
      { name: "Khalil Herbert", pos: "RB", nflTeam: "CHI", isStarter: true },
      { name: "Diontae Johnson", pos: "WR", nflTeam: "CAR", isStarter: true },
      { name: "Greg Zuerlein", pos: "K", nflTeam: "NYJ", isStarter: true },
      { name: "New York Jets", pos: "DST", nflTeam: "NYJ", isStarter: true },
      { name: "Roschon Johnson", pos: "RB", nflTeam: "CHI" },
      { name: "Cedric Tillman", pos: "WR", nflTeam: "CLE" },
      { name: "Juwan Johnson", pos: "TE", nflTeam: "NO" },
      { name: "Aidan O'Connell", pos: "QB", nflTeam: "LV" },
      { name: "Keaton Mitchell", pos: "RB", nflTeam: "BAL" },
      { name: "Marvin Mims Jr.", pos: "WR", nflTeam: "DEN" },
      { name: "Wil Lutz", pos: "K", nflTeam: "DEN" },
    ],
  },
  // ── CENTRAL ───────────────────────────────────────────
  {
    id: "pattie", teamName: "Team Pattie", owner: "Jonas Pattie", division: "Central",
    players: [
      { name: "C.J. Stroud", pos: "QB", nflTeam: "HOU", isStarter: true },
      { name: "Bijan Robinson", pos: "RB", nflTeam: "ATL", isStarter: true },
      { name: "De'Von Achane", pos: "RB", nflTeam: "MIA", isStarter: true },
      { name: "Davante Adams", pos: "WR", nflTeam: "NYJ", isStarter: true },
      { name: "Jaylen Waddle", pos: "WR", nflTeam: "MIA", isStarter: true },
      { name: "Mark Andrews", pos: "TE", nflTeam: "BAL", isStarter: true },
      { name: "Sam Darnold", pos: "QB", nflTeam: "MIN", isStarter: true },
      { name: "Raheem Mostert", pos: "RB", nflTeam: "MIA", isStarter: true },
      { name: "Brandin Cooks", pos: "WR", nflTeam: "DAL", isStarter: true },
      { name: "Younghoe Koo", pos: "K", nflTeam: "ATL", isStarter: true },
      { name: "Miami Dolphins", pos: "DST", nflTeam: "MIA", isStarter: true },
      { name: "Chuba Hubbard", pos: "RB", nflTeam: "CAR" },
      { name: "Wan'Dale Robinson", pos: "WR", nflTeam: "NYG" },
      { name: "Luke Musgrave", pos: "TE", nflTeam: "GB" },
      { name: "Desmond Ridder", pos: "QB", nflTeam: "ARI" },
      { name: "Tyjae Spears", pos: "RB", nflTeam: "TEN" },
      { name: "Rashid Shaheed", pos: "WR", nflTeam: "NO" },
      { name: "Chris Boswell", pos: "K", nflTeam: "PIT" },
    ],
  },
  {
    id: "krause", teamName: "Team Krause", owner: "Bill Krause", division: "Central",
    players: [
      { name: "Trevor Lawrence", pos: "QB", nflTeam: "JAX", isStarter: true },
      { name: "Austin Ekeler", pos: "RB", nflTeam: "WAS", isStarter: true },
      { name: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", isStarter: true },
      { name: "Deebo Samuel", pos: "WR", nflTeam: "SF", isStarter: true },
      { name: "Chris Olave", pos: "WR", nflTeam: "NO", isStarter: true },
      { name: "Evan Engram", pos: "TE", nflTeam: "JAX", isStarter: true },
      { name: "Geno Smith", pos: "QB", nflTeam: "SEA", isStarter: true },
      { name: "Kareem Hunt", pos: "RB", nflTeam: "CLE", isStarter: true },
      { name: "Courtland Sutton", pos: "WR", nflTeam: "DEN", isStarter: true },
      { name: "Dustin Hopkins", pos: "K", nflTeam: "CLE", isStarter: true },
      { name: "Cleveland Browns", pos: "DST", nflTeam: "CLE", isStarter: true },
      { name: "Devin Singletary", pos: "RB", nflTeam: "NYG" },
      { name: "Darnell Mooney", pos: "WR", nflTeam: "ATL" },
      { name: "Dawson Knox", pos: "TE", nflTeam: "BUF" },
      { name: "Tommy DeVito", pos: "QB", nflTeam: "NYG" },
      { name: "Zack Moss", pos: "RB", nflTeam: "IND" },
      { name: "Quentin Johnston", pos: "WR", nflTeam: "LAC" },
      { name: "Eddy Pineiro", pos: "K", nflTeam: "CAR" },
    ],
  },
  {
    id: "ryks", teamName: "Team Ryks", owner: "David Ryks", division: "Central",
    players: [
      { name: "Jordan Love", pos: "QB", nflTeam: "GB", isStarter: true },
      { name: "Alvin Kamara", pos: "RB", nflTeam: "NO", isStarter: true },
      { name: "Isiah Pacheco", pos: "RB", nflTeam: "KC", isStarter: true },
      { name: "Garrett Wilson", pos: "WR", nflTeam: "NYJ", isStarter: true },
      { name: "Drake London", pos: "WR", nflTeam: "ATL", isStarter: true },
      { name: "Kyle Pitts", pos: "TE", nflTeam: "ATL", isStarter: true },
      { name: "Justin Fields", pos: "QB", nflTeam: "PIT", isStarter: true },
      { name: "Ezekiel Elliott", pos: "RB", nflTeam: "NE", isStarter: true },
      { name: "Michael Pittman Jr.", pos: "WR", nflTeam: "IND", isStarter: true },
      { name: "Jason Sanders", pos: "K", nflTeam: "MIA", isStarter: true },
      { name: "Pittsburgh Steelers", pos: "DST", nflTeam: "PIT", isStarter: true },
      { name: "Najee Harris", pos: "RB", nflTeam: "PIT" },
      { name: "Skyy Moore", pos: "WR", nflTeam: "KC" },
      { name: "Chigoziem Okonkwo", pos: "TE", nflTeam: "TEN" },
      { name: "Bryce Young", pos: "QB", nflTeam: "CAR" },
      { name: "Ty Chandler", pos: "RB", nflTeam: "SF" },
      { name: "Demarcus Robinson", pos: "WR", nflTeam: "LAR" },
      { name: "Matt Gay", pos: "K", nflTeam: "IND" },
    ],
  },
  {
    id: "osicki", teamName: "Team Osicki", owner: "Dan Osicki", division: "Central",
    players: [
      { name: "Kyler Murray", pos: "QB", nflTeam: "ARI", isStarter: true },
      { name: "James Conner", pos: "RB", nflTeam: "ARI", isStarter: true },
      { name: "Miles Sanders", pos: "RB", nflTeam: "CAR", isStarter: true },
      { name: "Zay Jones", pos: "WR", nflTeam: "ARI", isStarter: true },
      { name: "Jahan Dotson", pos: "WR", nflTeam: "WAS", isStarter: true },
      { name: "Gerald Everett", pos: "TE", nflTeam: "LAC", isStarter: true },
      { name: "Deshaun Watson", pos: "QB", nflTeam: "CLE", isStarter: true },
      { name: "Cam Akers", pos: "RB", nflTeam: "MIN", isStarter: true },
      { name: "Kadarius Toney", pos: "WR", nflTeam: "KC", isStarter: true },
      { name: "Riley Patterson", pos: "K", nflTeam: "JAX", isStarter: true },
      { name: "Arizona Cardinals", pos: "DST", nflTeam: "ARI", isStarter: true },
      { name: "Damien Harris", pos: "RB", nflTeam: "BUF" },
      { name: "Parris Campbell", pos: "WR", nflTeam: "NYG" },
      { name: "Tyler Conklin", pos: "TE", nflTeam: "NYJ" },
      { name: "Malik Willis", pos: "QB", nflTeam: "TEN" },
      { name: "Elijah Mitchell", pos: "RB", nflTeam: "SF" },
      { name: "Josh Reynolds", pos: "WR", nflTeam: "DET" },
      { name: "Tristan Vizcaino", pos: "K", nflTeam: "WAS" },
    ],
  },
  // ── WEST ──────────────────────────────────────────────
  {
    id: "heiden", teamName: "Team Heiden", owner: "Jason Heiden", division: "West",
    players: [
      { name: "Joe Burrow", pos: "QB", nflTeam: "CIN", isStarter: true },
      { name: "Nick Chubb", pos: "RB", nflTeam: "CLE", isStarter: true },
      { name: "Aaron Jones", pos: "RB", nflTeam: "MIN", isStarter: true },
      { name: "Stefon Diggs", pos: "WR", nflTeam: "HOU", isStarter: true },
      { name: "Amari Cooper", pos: "WR", nflTeam: "CLE", isStarter: true },
      { name: "Pat Freiermuth", pos: "TE", nflTeam: "PIT", isStarter: true },
      { name: "Derek Carr", pos: "QB", nflTeam: "NO", isStarter: true },
      { name: "Elijah Mitchell", pos: "RB", nflTeam: "SF", isStarter: true },
      { name: "Mecole Hardman", pos: "WR", nflTeam: "KC", isStarter: true },
      { name: "Cameron Dicker", pos: "K", nflTeam: "LAC", isStarter: true },
      { name: "Kansas City Chiefs", pos: "DST", nflTeam: "KC", isStarter: true },
      { name: "Samaje Perine", pos: "RB", nflTeam: "DEN" },
      { name: "Tutu Atwell", pos: "WR", nflTeam: "LAR" },
      { name: "Irv Smith Jr.", pos: "TE", nflTeam: "CIN" },
      { name: "Hendon Hooker", pos: "QB", nflTeam: "DET" },
      { name: "Kimani Vidal", pos: "RB", nflTeam: "LAC" },
      { name: "Kalif Raymond", pos: "WR", nflTeam: "DET" },
      { name: "Nick Folk", pos: "K", nflTeam: "TEN" },
    ],
  },
  {
    id: "akagi", teamName: "Team Akagi", owner: "Greg Akagi", division: "West",
    players: [
      { name: "Dak Prescott", pos: "QB", nflTeam: "DAL", isStarter: true },
      { name: "Tony Pollard", pos: "RB", nflTeam: "TEN", isStarter: true },
      { name: "Javonte Williams", pos: "RB", nflTeam: "DEN", isStarter: true },
      { name: "Keenan Allen", pos: "WR", nflTeam: "CHI", isStarter: true },
      { name: "DeAndre Hopkins", pos: "WR", nflTeam: "TEN", isStarter: true },
      { name: "Dalton Schultz", pos: "TE", nflTeam: "HOU", isStarter: true },
      { name: "Bryce Young", pos: "QB", nflTeam: "CAR", isStarter: true },
      { name: "Roschon Johnson", pos: "RB", nflTeam: "CHI", isStarter: true },
      { name: "Dontayvion Wicks", pos: "WR", nflTeam: "GB", isStarter: true },
      { name: "Jake Moody", pos: "K", nflTeam: "SF", isStarter: true },
      { name: "Green Bay Packers", pos: "DST", nflTeam: "GB", isStarter: true },
      { name: "Dameon Pierce", pos: "RB", nflTeam: "HOU" },
      { name: "Darius Slayton", pos: "WR", nflTeam: "NYG" },
      { name: "Noah Fant", pos: "TE", nflTeam: "SEA" },
      { name: "Aidan O'Connell", pos: "QB", nflTeam: "LV" },
      { name: "Patrick Taylor", pos: "RB", nflTeam: "MIA" },
      { name: "Marquez Valdes-Scantling", pos: "WR", nflTeam: "BUF" },
      { name: "Brayden Narveson", pos: "K", nflTeam: "GB" },
    ],
  },
  {
    id: "mackar", teamName: "Team Mackar", owner: "Scott Mackar", division: "West",
    players: [
      { name: "Kirk Cousins", pos: "QB", nflTeam: "ATL", isStarter: true },
      { name: "Rachaad White", pos: "RB", nflTeam: "TB", isStarter: true },
      { name: "Zack Moss", pos: "RB", nflTeam: "IND", isStarter: true },
      { name: "Odell Beckham Jr.", pos: "WR", nflTeam: "MIA", isStarter: true },
      { name: "Adam Thielen", pos: "WR", nflTeam: "CAR", isStarter: true },
      { name: "Tyler Higbee", pos: "TE", nflTeam: "LAR", isStarter: true },
      { name: "Jacoby Brissett", pos: "QB", nflTeam: "WAS", isStarter: true },
      { name: "Devin Singletary", pos: "RB", nflTeam: "NYG", isStarter: true },
      { name: "Darnell Mooney", pos: "WR", nflTeam: "ATL", isStarter: true },
      { name: "Graham Gano", pos: "K", nflTeam: "NYG", isStarter: true },
      { name: "New England Patriots", pos: "DST", nflTeam: "NE", isStarter: true },
      { name: "Damien Harris", pos: "RB", nflTeam: "BUF" },
      { name: "Parris Campbell", pos: "WR", nflTeam: "NYG" },
      { name: "Tyler Conklin", pos: "TE", nflTeam: "NYJ" },
      { name: "Tommy DeVito", pos: "QB", nflTeam: "NYG" },
      { name: "Elijah Mitchell", pos: "RB", nflTeam: "SF" },
      { name: "Josh Reynolds", pos: "WR", nflTeam: "DET" },
      { name: "Tristan Vizcaino", pos: "K", nflTeam: "WAS" },
    ],
  },
  {
    id: "cromer", teamName: "Team Cromer", owner: "Keith Cromer", division: "West",
    players: [
      { name: "Matthew Stafford", pos: "QB", nflTeam: "LAR", isStarter: true },
      { name: "Cam Akers", pos: "RB", nflTeam: "MIN", isStarter: true },
      { name: "Dameon Pierce", pos: "RB", nflTeam: "HOU", isStarter: true },
      { name: "Demarcus Robinson", pos: "WR", nflTeam: "LAR", isStarter: true },
      { name: "Van Jefferson", pos: "WR", nflTeam: "ATL", isStarter: true },
      { name: "Tyler Conklin", pos: "TE", nflTeam: "NYJ", isStarter: true },
      { name: "Tommy DeVito", pos: "QB", nflTeam: "NYG", isStarter: true },
      { name: "Roschon Johnson", pos: "RB", nflTeam: "CHI", isStarter: true },
      { name: "Marquez Valdes-Scantling", pos: "WR", nflTeam: "BUF", isStarter: true },
      { name: "Tristan Vizcaino", pos: "K", nflTeam: "WAS", isStarter: true },
      { name: "Carolina Panthers", pos: "DST", nflTeam: "CAR", isStarter: true },
      { name: "Elijah Mitchell", pos: "RB", nflTeam: "SF" },
      { name: "Josh Reynolds", pos: "WR", nflTeam: "DET" },
      { name: "Juwan Johnson", pos: "TE", nflTeam: "NO" },
      { name: "Malik Willis", pos: "QB", nflTeam: "TEN" },
      { name: "Patrick Taylor", pos: "RB", nflTeam: "MIA" },
      { name: "Kalif Raymond", pos: "WR", nflTeam: "DET" },
      { name: "Nick Folk", pos: "K", nflTeam: "TEN" },
    ],
  },
];

const POS_COLORS: Record<string, { bg: string; text: string }> = {
  QB:  { bg: "oklch(0.92 0.08 25)",  text: "oklch(0.35 0.15 25)"  },
  RB:  { bg: "oklch(0.92 0.07 150)", text: "oklch(0.3 0.12 150)"  },
  WR:  { bg: "oklch(0.9 0.08 260)",  text: "oklch(0.3 0.12 260)"  },
  TE:  { bg: "oklch(0.92 0.1 85)",   text: "oklch(0.35 0.15 85)"  },
  K:   { bg: "oklch(0.93 0.04 300)", text: "oklch(0.4 0.08 300)"  },
  DST: { bg: "oklch(0.92 0.04 0)",   text: "oklch(0.35 0.08 0)"   },
};

const DIVISIONS = ["East", "Central", "West"] as const;

export default function Rosters() {
  const { franchise } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<"All" | "East" | "Central" | "West">("All");
  const filtered = selectedDivision === "All"
    ? ROSTERS
    : ROSTERS.filter(f => f.division === selectedDivision);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>WRC Rosters</h1>
          <p>2025 Season — All 12 Franchises</p>
        </div>

        {/* Division Filter */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {(["All", "East", "Central", "West"] as const).map(div => (
            <button
              key={div}
              onClick={() => setSelectedDivision(div)}
              style={{
                padding: "0.4rem 1.1rem",
                borderRadius: 20,
                border: "2px solid",
                borderColor: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.25)",
                background: selectedDivision === div ? "oklch(0.78 0.15 85)" : "rgba(0,0,0,0.3)",
                color: selectedDivision === div ? "oklch(0.18 0.05 85)" : "white",
                fontFamily: "Oswald, sans-serif",
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
            >
              {div === "All" ? "All Divisions" : `${div} Division`}
            </button>
          ))}
        </div>

        {/* Roster Cards Grid */}
        {DIVISIONS.filter(d => selectedDivision === "All" || selectedDivision === d).map(div => (
          <div key={div} style={{ marginBottom: "2rem" }}>
            {/* Division Label */}
            <div style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "oklch(0.78 0.15 85)",
              marginBottom: "0.75rem",
              paddingLeft: "0.25rem",
            }}>
              {div} Division
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}>
              {ROSTERS.filter(f => f.division === div).map(team => {
                const isMyTeam = team.teamName === franchise?.team_name;
                const starters = sortPlayers(team.players.filter(p => p.isStarter));
                const bench = sortPlayers(team.players.filter(p => !p.isStarter));

                return (
                  <div
                    key={team.id}
                    className="wrc-card"
                    style={{
                      outline: isMyTeam ? "2px solid oklch(0.78 0.15 85)" : "none",
                    }}
                  >
                    <div className="wrc-card-gold-stripe" />

                    {/* Team Header */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.85rem 1rem 0.6rem",
                    }}>
                      {/* Logo slot */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        background: "oklch(0.92 0.02 150)",
                        border: "1.5px dashed oklch(0.75 0.06 150)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: "0.55rem",
                        color: "oklch(0.6 0.04 150)",
                        fontFamily: "Oswald, sans-serif",
                        letterSpacing: "0.04em",
                        fontWeight: 600,
                      }}>
                        {team.logo ? <img src={team.logo} alt={team.teamName} style={{ width: 40, height: 40, objectFit: "contain" }} /> : "LOGO"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "Oswald, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "oklch(0.18 0.05 150)",
                          letterSpacing: "0.02em",
                        }}>
                          {team.teamName}
                          {isMyTeam && (
                            <span style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.6rem",
                              background: "oklch(0.78 0.15 85)",
                              color: "oklch(0.18 0.05 85)",
                              borderRadius: 10,
                              padding: "1px 6px",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              verticalAlign: "middle",
                            }}>YOU</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "oklch(0.5 0.04 150)" }}>{team.owner}</div>
                        {team.faabRemaining !== undefined && (
                          <div style={{
                            marginTop: "0.2rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.68rem",
                            fontFamily: "Oswald, sans-serif",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: team.faabRemaining > 100 ? "oklch(0.35 0.13 150)" : team.faabRemaining > 50 ? "oklch(0.5 0.12 85)" : "oklch(0.45 0.18 25)",
                            background: team.faabRemaining > 100 ? "oklch(0.93 0.04 150)" : team.faabRemaining > 50 ? "oklch(0.95 0.06 85)" : "oklch(0.95 0.05 25)",
                            borderRadius: 4,
                            padding: "1px 6px",
                          }}>
                            FAAB: ${`${team.faabRemaining}`}
                          </div>
                        )}
                      </div>


                    </div>

                    {/* Full roster — always open */}
                      <div style={{ padding: "0 0 0.5rem" }}>
                        {/* Starters */}
                        <div style={{
                          padding: "0.3rem 1rem 0.2rem",
                          fontSize: "0.65rem",
                          fontFamily: "Oswald, sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "oklch(0.38 0.09 150)",
                          background: "oklch(0.96 0.01 150)",
                          borderTop: "1px solid oklch(0.9 0.01 150)",
                        }}>
                          Starters ({starters.length})
                        </div>
                        {starters.map((p, i) => (
                          <PlayerRow key={i} player={p} alt={i % 2 !== 0} />
                        ))}

                        {/* Bench */}
                        <div style={{
                          padding: "0.3rem 1rem 0.2rem",
                          fontSize: "0.65rem",
                          fontFamily: "Oswald, sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "oklch(0.5 0.04 150)",
                          background: "oklch(0.97 0.005 150)",
                          borderTop: "1px solid oklch(0.9 0.01 150)",
                        }}>
                          Bench ({bench.length})
                        </div>
                        {bench.map((p, i) => (
                          <PlayerRow key={i} player={p} alt={i % 2 !== 0} bench />
                        ))}
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerRow({ player, alt, bench }: { player: Player; alt: boolean; bench?: boolean }) {
  const c = POS_COLORS[player.pos];
  const isFa = player.acq?.startsWith("FA");
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      padding: "0.35rem 1rem",
      background: alt ? "oklch(0.975 0.003 150)" : "white",
      opacity: bench ? 0.85 : 1,
    }}>
      <span style={{
        background: c.bg,
        color: c.text,
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: "0.62rem",
        fontWeight: 700,
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.04em",
        minWidth: 28,
        textAlign: "center",
        flexShrink: 0,
      }}>{player.pos}</span>
      <span style={{
        flex: 1,
        fontSize: "0.8rem",
        fontWeight: bench ? 400 : 600,
        color: bench ? "oklch(0.5 0.04 150)" : "oklch(0.18 0.05 150)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{player.name}</span>
      <span style={{
        fontSize: "0.68rem",
        color: "oklch(0.55 0.06 150)",
        fontWeight: 600,
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}>{player.nflTeam}</span>

      {player.acq && (
        <span style={{
          fontSize: "0.6rem",
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "1px 5px",
          borderRadius: 3,
          flexShrink: 0,
          background: isFa ? "oklch(0.93 0.06 250)" : "oklch(0.93 0.03 150)",
          color: isFa ? "oklch(0.32 0.14 250)" : "oklch(0.35 0.08 150)",
        }}>{player.acq}</span>
      )}
    </div>
  );
}
