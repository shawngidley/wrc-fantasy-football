/**
 * WRC Fantasy Football - Live Scoring Page
 * Layout matches reference: matchup selector bar → two-column score header with
 * progress bars → slot-by-slot player comparison with position label in center divider.
 * Player headshot placeholder, large orange fantasy pts, stat chips below each player.
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Clock } from "lucide-react";

const REFRESH_SECONDS = 300;

// ── Types ──────────────────────────────────────────────────────────────────────
type StatChip = { label: string; value: string | number };

type SlotPlayer = {
  name: string;          // "D. Prescott" (abbreviated first name)
  fullName: string;
  pos: string;           // "QB"
  nflTeam: string;       // "DAL"
  pts: number;           // fantasy points scored
  proj: number;          // projected total
  gameInfo: string;      // "DAL 30 @ WAS 23 F"
  stats: StatChip[];
  isTE?: boolean;
  status?: "active" | "bye" | "out" | "dnp";
};

type SlotRow = {
  slotLabel: string;     // "QB", "RB", "WR", "TE", "SFLEX", "FLEX", "K", "DST"
  home: SlotPlayer | null;
  away: SlotPlayer | null;
};

type TeamSide = {
  team: string;
  owner: string;
  score: number;
  projected: number;
  playersPlayed: number;
  playersTotal: number;
  logo?: string;
};

type Matchup = {
  id: number;
  week: number;
  isChallenge: boolean;
  home: TeamSide;
  away: TeamSide;
  slots: SlotRow[];
};

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_MATCHUPS: Matchup[] = [
  {
    id: 1, week: 14, isChallenge: true,
    home: { team: "Team Gidley", owner: "Shawn Gidley", score: 202.7, projected: 218.4, playersPlayed: 10, playersTotal: 10 },
    away: { team: "Team Pattie", owner: "Jonas Pattie", score: 141.48, projected: 168.2, playersPlayed: 10, playersTotal: 10 },
    slots: [
      {
        slotLabel: "QB",
        home: { name: "D. Prescott", fullName: "Dak Prescott", pos: "QB", nflTeam: "DAL", pts: 20.68, proj: 20.68, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 307 }, { label: "TD", value: 2 }, { label: "YDS", value: 24 }] },
        away: { name: "S. Darnold", fullName: "Sam Darnold", pos: "QB", nflTeam: "SEA", pts: 3.08, proj: 3.08, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 147 }, { label: "TD", value: 1 }, { label: "YDS", value: 2 }, { label: "TO", value: 2 }] },
      },
      {
        slotLabel: "RB",
        home: { name: "D. Henry", fullName: "Derrick Henry", pos: "RB", nflTeam: "BAL", pts: 45.6, proj: 45.6, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 216 }, { label: "TD", value: 4 }] },
        away: { name: "J. Cook", fullName: "James Cook", pos: "RB", nflTeam: "BUF", pts: 8.7, proj: 8.7, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 74 }, { label: "REC", value: 1 }, { label: "YDS", value: 3 }] },
      },
      {
        slotLabel: "RB",
        home: { name: "C. McCaffr...", fullName: "Christian McCaffrey", pos: "RB", nflTeam: "SF", pts: 28.1, proj: 28.1, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 140 }, { label: "TD", value: 1 }, { label: "REC", value: 4 }, { label: "YDS", value: 41 }] },
        away: { name: "B. Robinson", fullName: "Bijan Robinson", pos: "RB", nflTeam: "ATL", pts: 39.9, proj: 39.9, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "YDS", value: 195 }, { label: "TD", value: 1 }, { label: "REC", value: 5 }, { label: "YDS", value: 34 }, { label: "TD", value: 1 }] },
      },
      {
        slotLabel: "WR",
        home: { name: "G. Pickens", fullName: "George Pickens", pos: "WR", nflTeam: "DAL", pts: 11.8, proj: 11.8, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 78 }] },
        away: { name: "T. Higgins", fullName: "Tee Higgins", pos: "WR", nflTeam: "CIN", pts: 9.9, proj: 9.9, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 59 }] },
      },
      {
        slotLabel: "WR",
        home: { name: "A. St. Brown", fullName: "Amon-Ra St. Brown", pos: "WR", nflTeam: "DET", pts: 14.8, proj: 14.8, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "REC", value: 8 }, { label: "YDS", value: 68 }] },
        away: { name: "D. Smith", fullName: "DeVonta Smith", pos: "WR", nflTeam: "PHI", pts: 4.5, proj: 4.5, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 25 }] },
      },
      {
        slotLabel: "TE",
        home: { name: "H. Henry", fullName: "Hunter Henry", pos: "TE", nflTeam: "NE", pts: 15.4, proj: 15.4, isTE: true, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 49 }, { label: "TD", value: 1 }] },
        away: { name: "D. Goedert", fullName: "Dallas Goedert", pos: "TE", nflTeam: "PHI", pts: 11.3, proj: 11.3, isTE: true, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 8 }, { label: "TD", value: 1 }] },
      },
      {
        slotLabel: "SFLEX",
        home: { name: "J. Allen", fullName: "Josh Allen", pos: "QB", nflTeam: "BUF", pts: 38.6, proj: 38.6, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 312 }, { label: "TD", value: 3 }, { label: "RUSH", value: 52 }] },
        away: { name: "J. Hurts", fullName: "Jalen Hurts", pos: "QB", nflTeam: "PHI", pts: 22.4, proj: 22.4, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 198 }, { label: "TD", value: 1 }, { label: "RUSH", value: 48 }] },
      },
      {
        slotLabel: "FLEX",
        home: { name: "T. Pollard", fullName: "Tony Pollard", pos: "RB", nflTeam: "TEN", pts: 12.4, proj: 12.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 84 }, { label: "REC", value: 2 }, { label: "YDS", value: 20 }] },
        away: { name: "D. Adams", fullName: "Davante Adams", pos: "WR", nflTeam: "LV", pts: 8.6, proj: 8.6, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 56 }] },
      },
      {
        slotLabel: "K",
        home: { name: "H. Butker", fullName: "Harrison Butker", pos: "K", nflTeam: "KC", pts: 14.0, proj: 14.0, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "FG", value: "3/3" }, { label: "XP", value: "5/5" }] },
        away: { name: "Y. Koo", fullName: "Younghoe Koo", pos: "K", nflTeam: "ATL", pts: 7.0, proj: 7.0, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "4/4" }] },
      },
      {
        slotLabel: "DST",
        home: { name: "San Francisco", fullName: "San Francisco 49ers", pos: "DST", nflTeam: "SF", pts: 21.4, proj: 21.4, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "SACK", value: 4 }, { label: "INT", value: 2 }, { label: "TD", value: 1 }] },
        away: { name: "Miami", fullName: "Miami Dolphins", pos: "DST", nflTeam: "MIA", pts: 16.0, proj: 16.0, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] },
      },
    ],
  },
  {
    id: 2, week: 14, isChallenge: false,
    home: { team: "Team Sotka", owner: "David Sotka", score: 112.8, projected: 131.2, playersPlayed: 10, playersTotal: 10 },
    away: { team: "Team Krause", owner: "Bill Krause", score: 95.6, projected: 108.4, playersPlayed: 10, playersTotal: 10 },
    slots: [
      { slotLabel: "QB", home: { name: "P. Mahomes", fullName: "Patrick Mahomes", pos: "QB", nflTeam: "KC", pts: 28.4, proj: 28.4, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 312 }, { label: "TD", value: 3 }] }, away: { name: "T. Lawrence", fullName: "Trevor Lawrence", pos: "QB", nflTeam: "JAX", pts: 18.2, proj: 18.2, gameInfo: "JAX 20 @ TEN 17 F", stats: [{ label: "YDS", value: 224 }, { label: "TD", value: 2 }] } },
      { slotLabel: "RB", home: { name: "C. McCaffrey", fullName: "Christian McCaffrey", pos: "RB", nflTeam: "SF", pts: 24.6, proj: 24.6, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 148 }, { label: "TD", value: 1 }, { label: "REC", value: 5 }] }, away: { name: "A. Ekeler", fullName: "Austin Ekeler", pos: "RB", nflTeam: "WAS", pts: 14.2, proj: 14.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 72 }, { label: "REC", value: 4 }, { label: "YDS", value: 30 }] } },
      { slotLabel: "RB", home: { name: "S. Barkley", fullName: "Saquon Barkley", pos: "RB", nflTeam: "PHI", pts: 18.8, proj: 18.8, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 108 }, { label: "TD", value: 1 }] }, away: { name: "J. Gibbs", fullName: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", pts: 16.4, proj: 16.4, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 94 }, { label: "REC", value: 3 }, { label: "YDS", value: 20 }] } },
      { slotLabel: "WR", home: { name: "T. Hill", fullName: "Tyreek Hill", pos: "WR", nflTeam: "MIA", pts: 14.2, proj: 14.2, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "REC", value: 7 }, { label: "YDS", value: 92 }] }, away: { name: "D. Samuel", fullName: "Deebo Samuel", pos: "WR", nflTeam: "SF", pts: 9.8, proj: 9.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 68 }] } },
      { slotLabel: "WR", home: { name: "C. Lamb", fullName: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", pts: 8.6, proj: 8.6, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 56 }] }, away: { name: "C. Olave", fullName: "Chris Olave", pos: "WR", nflTeam: "NO", pts: 11.4, proj: 11.4, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 6 }, { label: "YDS", value: 84 }] } },
      { slotLabel: "TE", home: { name: "T. Kelce", fullName: "Travis Kelce", pos: "TE", nflTeam: "KC", pts: 9.0, proj: 9.0, isTE: true, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 40 }] }, away: { name: "E. Engram", fullName: "Evan Engram", pos: "TE", nflTeam: "JAX", pts: 8.2, proj: 8.2, isTE: true, gameInfo: "JAX 20 @ TEN 17 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 32 }] } },
      { slotLabel: "SFLEX", home: { name: "D. Prescott", fullName: "Dak Prescott", pos: "QB", nflTeam: "DAL", pts: 14.2, proj: 14.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 307 }, { label: "TD", value: 2 }] }, away: { name: "G. Smith", fullName: "Geno Smith", pos: "QB", nflTeam: "SEA", pts: 12.6, proj: 12.6, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 248 }, { label: "TD", value: 2 }] } },
      { slotLabel: "FLEX", home: { name: "R. Stevenson", fullName: "Rhamondre Stevenson", pos: "RB", nflTeam: "NE", pts: 8.4, proj: 8.4, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "YDS", value: 64 }, { label: "REC", value: 2 }] }, away: { name: "K. Hunt", fullName: "Kareem Hunt", pos: "RB", nflTeam: "CLE", pts: 6.8, proj: 6.8, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "YDS", value: 48 }, { label: "REC", value: 2 }] } },
      { slotLabel: "K", home: { name: "T. Bass", fullName: "Tyler Bass", pos: "K", nflTeam: "BUF", pts: 8.0, proj: 8.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] }, away: { name: "D. Hopkins", fullName: "Dustin Hopkins", pos: "K", nflTeam: "CLE", pts: 6.0, proj: 6.0, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "FG", value: "1/2" }, { label: "XP", value: "3/3" }] } },
      { slotLabel: "DST", home: { name: "Dallas", fullName: "Dallas Cowboys", pos: "DST", nflTeam: "DAL", pts: 7.0, proj: 7.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }] }, away: { name: "Cleveland", fullName: "Cleveland Browns", pos: "DST", nflTeam: "CLE", pts: 10.2, proj: 10.2, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] } },
    ],
  },
  {
    id: 3, week: 14, isChallenge: false,
    home: { team: "Team Heiden", owner: "Jason Heiden", score: 78.2, projected: 119.8, playersPlayed: 7, playersTotal: 10 },
    away: { team: "Team Nelson", owner: "Scott Nelson", score: 84.6, projected: 112.2, playersPlayed: 8, playersTotal: 10 },
    slots: [
      { slotLabel: "QB", home: { name: "J. Burrow", fullName: "Joe Burrow", pos: "QB", nflTeam: "CIN", pts: 22.4, proj: 22.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 284 }, { label: "TD", value: 3 }] }, away: { name: "J. Hurts", fullName: "Jalen Hurts", pos: "QB", nflTeam: "PHI", pts: 18.6, proj: 18.6, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 198 }, { label: "TD", value: 1 }, { label: "RUSH", value: 48 }] } },
      { slotLabel: "RB", home: { name: "N. Chubb", fullName: "Nick Chubb", pos: "RB", nflTeam: "CLE", pts: 8.4, proj: 8.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "YDS", value: 54 }, { label: "REC", value: 2 }] }, away: { name: "J. Taylor", fullName: "Jonathan Taylor", pos: "RB", nflTeam: "IND", pts: 14.8, proj: 14.8, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 98 }, { label: "TD", value: 1 }] } },
      { slotLabel: "RB", home: { name: "A. Jones", fullName: "Aaron Jones", pos: "RB", nflTeam: "MIN", pts: 12.6, proj: 12.6, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 76 }, { label: "REC", value: 3 }, { label: "YDS", value: 20 }] }, away: { name: "J. Jacobs", fullName: "Josh Jacobs", pos: "RB", nflTeam: "GB", pts: 16.2, proj: 16.2, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 102 }, { label: "TD", value: 1 }] } },
      { slotLabel: "WR", home: { name: "S. Diggs", fullName: "Stefon Diggs", pos: "WR", nflTeam: "HOU", pts: 9.8, proj: 9.8, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "REC", value: 6 }, { label: "YDS", value: 68 }] }, away: { name: "J. Jefferson", fullName: "Justin Jefferson", pos: "WR", nflTeam: "MIN", pts: 18.4, proj: 18.4, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "REC", value: 9 }, { label: "YDS", value: 134 }] } },
      { slotLabel: "WR", home: { name: "A. Cooper", fullName: "Amari Cooper", pos: "WR", nflTeam: "CLE", pts: 7.2, proj: 7.2, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 52 }] }, away: { name: "A. St. Brown", fullName: "Amon-Ra St. Brown", pos: "WR", nflTeam: "DET", pts: 14.8, proj: 14.8, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "REC", value: 8 }, { label: "YDS", value: 68 }] } },
      { slotLabel: "TE", home: { name: "P. Freiermuth", fullName: "Pat Freiermuth", pos: "TE", nflTeam: "PIT", pts: 6.8, proj: 6.8, isTE: true, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] }, away: { name: "D. Goedert", fullName: "Dallas Goedert", pos: "TE", nflTeam: "PHI", pts: 11.3, proj: 11.3, isTE: true, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 8 }, { label: "TD", value: 1 }] } },
      { slotLabel: "SFLEX", home: { name: "D. Carr", fullName: "Derek Carr", pos: "QB", nflTeam: "NO", pts: 0, proj: 14.2, gameInfo: "NO 24 @ TB 17 F", stats: [] }, away: { name: "A. Richardson", fullName: "Anthony Richardson", pos: "QB", nflTeam: "IND", pts: 0, proj: 18.6, gameInfo: "TEN 17 @ IND 24 F", stats: [] } },
      { slotLabel: "FLEX", home: { name: "M. Hardman", fullName: "Mecole Hardman", pos: "WR", nflTeam: "KC", pts: 4.2, proj: 4.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 22 }] }, away: { name: "D. Pierce", fullName: "Dameon Pierce", pos: "RB", nflTeam: "HOU", pts: 0, proj: 8.4, gameInfo: "HOU 24 @ PIT 20 F", stats: [] } },
      { slotLabel: "K", home: { name: "C. Dicker", fullName: "Cameron Dicker", pos: "K", nflTeam: "LAC", pts: 7.0, proj: 7.0, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "1/1" }] }, away: { name: "J. Elliott", fullName: "Jake Elliott", pos: "K", nflTeam: "PHI", pts: 5.0, proj: 5.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] } },
      { slotLabel: "DST", home: { name: "Kansas City", fullName: "Kansas City Chiefs", pos: "DST", nflTeam: "KC", pts: 0, proj: 8.4, gameInfo: "LV 14 @ KC 31 F", stats: [] }, away: { name: "Philadelphia", fullName: "Philadelphia Eagles", pos: "DST", nflTeam: "PHI", pts: 5.0, proj: 5.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "SACK", value: 2 }] } },
    ],
  },
  {
    id: 4, week: 14, isChallenge: false,
    home: { team: "Team Akagi", owner: "Greg Akagi", score: 105.4, projected: 122.6, playersPlayed: 10, playersTotal: 10 },
    away: { team: "Team Yane", owner: "James Yane", score: 88.8, projected: 98.4, playersPlayed: 10, playersTotal: 10 },
    slots: [
      { slotLabel: "QB", home: { name: "D. Prescott", fullName: "Dak Prescott", pos: "QB", nflTeam: "DAL", pts: 20.68, proj: 20.68, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 307 }, { label: "TD", value: 2 }] }, away: { name: "T. Tagovailoa", fullName: "Tua Tagovailoa", pos: "QB", nflTeam: "MIA", pts: 16.4, proj: 16.4, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "YDS", value: 224 }, { label: "TD", value: 2 }] } },
      { slotLabel: "RB", home: { name: "T. Pollard", fullName: "Tony Pollard", pos: "RB", nflTeam: "TEN", pts: 12.4, proj: 12.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 84 }, { label: "REC", value: 2 }] }, away: { name: "T. Pollard", fullName: "Tony Pollard", pos: "RB", nflTeam: "TEN", pts: 12.4, proj: 12.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 84 }, { label: "REC", value: 2 }] } },
      { slotLabel: "RB", home: { name: "J. Williams", fullName: "Javonte Williams", pos: "RB", nflTeam: "DEN", pts: 9.6, proj: 9.6, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "YDS", value: 56 }, { label: "REC", value: 2 }] }, away: { name: "D. Montgomery", fullName: "David Montgomery", pos: "RB", nflTeam: "DET", pts: 14.2, proj: 14.2, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 82 }, { label: "TD", value: 1 }] } },
      { slotLabel: "WR", home: { name: "K. Allen", fullName: "Keenan Allen", pos: "WR", nflTeam: "CHI", pts: 11.4, proj: 11.4, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "REC", value: 7 }, { label: "YDS", value: 74 }] }, away: { name: "P. Nacua", fullName: "Puka Nacua", pos: "WR", nflTeam: "LAR", pts: 8.8, proj: 8.8, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 58 }] } },
      { slotLabel: "WR", home: { name: "D. Hopkins", fullName: "DeAndre Hopkins", pos: "WR", nflTeam: "TEN", pts: 7.2, proj: 7.2, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 52 }] }, away: { name: "T. Higgins", fullName: "Tee Higgins", pos: "WR", nflTeam: "CIN", pts: 9.9, proj: 9.9, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 59 }] } },
      { slotLabel: "TE", home: { name: "D. Schultz", fullName: "Dalton Schultz", pos: "TE", nflTeam: "HOU", pts: 8.4, proj: 8.4, isTE: true, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 34 }] }, away: { name: "J. Ferguson", fullName: "Jake Ferguson", pos: "TE", nflTeam: "DAL", pts: 6.2, proj: 6.2, isTE: true, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 22 }] } },
      { slotLabel: "SFLEX", home: { name: "B. Young", fullName: "Bryce Young", pos: "QB", nflTeam: "CAR", pts: 14.8, proj: 14.8, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 198 }, { label: "TD", value: 1 }, { label: "RUSH", value: 32 }] }, away: { name: "B. Mayfield", fullName: "Baker Mayfield", pos: "QB", nflTeam: "TB", pts: 18.2, proj: 18.2, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "YDS", value: 248 }, { label: "TD", value: 2 }] } },
      { slotLabel: "FLEX", home: { name: "R. Johnson", fullName: "Roschon Johnson", pos: "RB", nflTeam: "CHI", pts: 8.4, proj: 8.4, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 4 }, { label: "YDS", value: 20 }] }, away: { name: "K. Herbert", fullName: "Khalil Herbert", pos: "RB", nflTeam: "CHI", pts: 6.8, proj: 6.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 48 }] } },
      { slotLabel: "K", home: { name: "J. Moody", fullName: "Jake Moody", pos: "K", nflTeam: "SF", pts: 7.0, proj: 7.0, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "1/1" }] }, away: { name: "G. Zuerlein", fullName: "Greg Zuerlein", pos: "K", nflTeam: "NYJ", pts: 5.0, proj: 5.0, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] } },
      { slotLabel: "DST", home: { name: "Green Bay", fullName: "Green Bay Packers", pos: "DST", nflTeam: "GB", pts: 6.0, proj: 6.0, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }] }, away: { name: "New York Jets", fullName: "New York Jets", pos: "DST", nflTeam: "NYJ", pts: 7.2, proj: 7.2, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "FR", value: 1 }] } },
    ],
  },
  {
    id: 5, week: 14, isChallenge: false,
    home: { team: "Team Mackar", owner: "Scott Mackar", score: 92.2, projected: 115.4, playersPlayed: 9, playersTotal: 10 },
    away: { team: "Team Ryks", owner: "David Ryks", score: 101.6, projected: 120.8, playersPlayed: 10, playersTotal: 10 },
    slots: [
      { slotLabel: "QB", home: { name: "L. Jackson", fullName: "Lamar Jackson", pos: "QB", nflTeam: "BAL", pts: 32.4, proj: 32.4, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 248 }, { label: "TD", value: 2 }, { label: "RUSH", value: 84 }, { label: "TD", value: 1 }] }, away: { name: "J. Love", fullName: "Jordan Love", pos: "QB", nflTeam: "GB", pts: 14.2, proj: 14.2, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] } },
      { slotLabel: "RB", home: { name: "D. Henry", fullName: "Derrick Henry", pos: "RB", nflTeam: "BAL", pts: 45.6, proj: 45.6, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 216 }, { label: "TD", value: 4 }] }, away: { name: "A. Kamara", fullName: "Alvin Kamara", pos: "RB", nflTeam: "NO", pts: 18.4, proj: 18.4, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "YDS", value: 88 }, { label: "TD", value: 1 }, { label: "REC", value: 4 }, { label: "YDS", value: 36 }] } },
      { slotLabel: "RB", home: { name: "B. Hall", fullName: "Breece Hall", pos: "RB", nflTeam: "NYJ", pts: 0, proj: 16.4, gameInfo: "NE 42 @ NYJ 10 F", stats: [] }, away: { name: "I. Pacheco", fullName: "Isiah Pacheco", pos: "RB", nflTeam: "KC", pts: 12.8, proj: 12.8, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 78 }, { label: "TD", value: 1 }] } },
      { slotLabel: "WR", home: { name: "J. Chase", fullName: "Ja'Marr Chase", pos: "WR", nflTeam: "CIN", pts: 14.4, proj: 14.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 7 }, { label: "YDS", value: 94 }] }, away: { name: "G. Wilson", fullName: "Garrett Wilson", pos: "WR", nflTeam: "NYJ", pts: 0, proj: 12.4, gameInfo: "NE 42 @ NYJ 10 F", stats: [] } },
      { slotLabel: "WR", home: { name: "S. Diggs", fullName: "Stefon Diggs", pos: "WR", nflTeam: "HOU", pts: 0, proj: 12.8, gameInfo: "HOU 24 @ PIT 20 F", stats: [] }, away: { name: "D. London", fullName: "Drake London", pos: "WR", nflTeam: "ATL", pts: 16.8, proj: 16.8, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 8 }, { label: "YDS", value: 108 }] } },
      { slotLabel: "TE", home: { name: "S. LaPorta", fullName: "Sam LaPorta", pos: "TE", nflTeam: "DET", pts: 0, proj: 9.4, isTE: true, gameInfo: "DET 10 @ MIN 23 F", stats: [] }, away: { name: "K. Pitts", fullName: "Kyle Pitts", pos: "TE", nflTeam: "ATL", pts: 12.4, proj: 12.4, isTE: true, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 48 }, { label: "TD", value: 1 }] } },
      { slotLabel: "SFLEX", home: { name: "J. Hurts", fullName: "Jalen Hurts", pos: "QB", nflTeam: "PHI", pts: 22.4, proj: 22.4, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 198 }, { label: "TD", value: 1 }, { label: "RUSH", value: 48 }] }, away: { name: "J. Fields", fullName: "Justin Fields", pos: "QB", nflTeam: "PIT", pts: 18.6, proj: 18.6, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "YDS", value: 224 }, { label: "TD", value: 1 }, { label: "RUSH", value: 64 }] } },
      { slotLabel: "FLEX", home: { name: "R. Rice", fullName: "Rashee Rice", pos: "WR", nflTeam: "KC", pts: 8.4, proj: 8.4, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 54 }] }, away: { name: "M. Pittman", fullName: "Michael Pittman Jr.", pos: "WR", nflTeam: "IND", pts: 9.8, proj: 9.8, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "REC", value: 6 }, { label: "YDS", value: 68 }] } },
      { slotLabel: "K", home: { name: "H. Butker", fullName: "Harrison Butker", pos: "K", nflTeam: "KC", pts: 14.0, proj: 14.0, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "FG", value: "3/3" }, { label: "XP", value: "5/5" }] }, away: { name: "J. Sanders", fullName: "Jason Sanders", pos: "K", nflTeam: "MIA", pts: 8.0, proj: 8.0, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] } },
      { slotLabel: "DST", home: { name: "San Francisco", fullName: "San Francisco 49ers", pos: "DST", nflTeam: "SF", pts: 21.4, proj: 21.4, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "SACK", value: 4 }, { label: "INT", value: 2 }, { label: "TD", value: 1 }] }, away: { name: "Pittsburgh", fullName: "Pittsburgh Steelers", pos: "DST", nflTeam: "PIT", pts: 9.4, proj: 9.4, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }] } },
    ],
  },
  {
    id: 6, week: 14, isChallenge: false,
    home: { team: "Team Cromer", owner: "Keith Cromer", score: 76.4, projected: 104.2, playersPlayed: 8, playersTotal: 10 },
    away: { team: "Team Osicki", owner: "Dan Osicki", score: 68.8, projected: 92.6, playersPlayed: 8, playersTotal: 10 },
    slots: [
      { slotLabel: "QB", home: { name: "K. Murray", fullName: "Kyler Murray", pos: "QB", nflTeam: "ARI", pts: 14.2, proj: 14.2, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] }, away: { name: "K. Murray", fullName: "Kyler Murray", pos: "QB", nflTeam: "ARI", pts: 14.2, proj: 14.2, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] } },
      { slotLabel: "RB", home: { name: "J. Conner", fullName: "James Conner", pos: "RB", nflTeam: "ARI", pts: 8.4, proj: 8.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 2 }] }, away: { name: "J. Conner", fullName: "James Conner", pos: "RB", nflTeam: "ARI", pts: 8.4, proj: 8.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 2 }] } },
      { slotLabel: "RB", home: { name: "M. Sanders", fullName: "Miles Sanders", pos: "RB", nflTeam: "CAR", pts: 6.2, proj: 6.2, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 32 }, { label: "REC", value: 2 }] }, away: { name: "C. Akers", fullName: "Cam Akers", pos: "RB", nflTeam: "MIN", pts: 9.8, proj: 9.8, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 58 }, { label: "REC", value: 2 }, { label: "YDS", value: 20 }] } },
      { slotLabel: "WR", home: { name: "Z. Jones", fullName: "Zay Jones", pos: "WR", nflTeam: "ARI", pts: 4.8, proj: 4.8, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] }, away: { name: "Z. Jones", fullName: "Zay Jones", pos: "WR", nflTeam: "ARI", pts: 4.8, proj: 4.8, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] } },
      { slotLabel: "WR", home: { name: "J. Dotson", fullName: "Jahan Dotson", pos: "WR", nflTeam: "WAS", pts: 7.4, proj: 7.4, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 54 }] }, away: { name: "K. Toney", fullName: "Kadarius Toney", pos: "WR", nflTeam: "KC", pts: 5.2, proj: 5.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 32 }] } },
      { slotLabel: "TE", home: { name: "G. Everett", fullName: "Gerald Everett", pos: "TE", nflTeam: "LAC", pts: 6.8, proj: 6.8, isTE: true, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] }, away: { name: "T. Conklin", fullName: "Tyler Conklin", pos: "TE", nflTeam: "NYJ", pts: 4.2, proj: 4.2, isTE: true, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] } },
      { slotLabel: "SFLEX", home: { name: "D. Watson", fullName: "Deshaun Watson", pos: "QB", nflTeam: "CLE", pts: 0, proj: 12.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [] }, away: { name: "M. Willis", fullName: "Malik Willis", pos: "QB", nflTeam: "TEN", pts: 8.4, proj: 8.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 124 }, { label: "RUSH", value: 44 }] } },
      { slotLabel: "FLEX", home: { name: "D. Harris", fullName: "Damien Harris", pos: "RB", nflTeam: "BUF", pts: 6.4, proj: 6.4, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 44 }] }, away: { name: "E. Mitchell", fullName: "Elijah Mitchell", pos: "RB", nflTeam: "SF", pts: 4.8, proj: 4.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 28 }, { label: "REC", value: 1 }] } },
      { slotLabel: "K", home: { name: "R. Patterson", fullName: "Riley Patterson", pos: "K", nflTeam: "JAX", pts: 8.0, proj: 8.0, gameInfo: "JAX 20 @ TEN 17 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] }, away: { name: "T. Vizcaino", fullName: "Tristan Vizcaino", pos: "K", nflTeam: "WAS", pts: 5.0, proj: 5.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] } },
      { slotLabel: "DST", home: { name: "Arizona", fullName: "Arizona Cardinals", pos: "DST", nflTeam: "ARI", pts: 14.0, proj: 14.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] }, away: { name: "Arizona", fullName: "Arizona Cardinals", pos: "DST", nflTeam: "ARI", pts: 14.0, proj: 14.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] } },
    ],
  },
];

// ── Helper: initials avatar ────────────────────────────────────────────────────
function PlayerAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "oklch(0.88 0.03 150)",
      border: "1.5px solid oklch(0.78 0.06 150)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      fontFamily: "Oswald, sans-serif", fontWeight: 700,
      fontSize: size * 0.35, color: "oklch(0.32 0.09 150)",
      letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function Chip({ label, value }: StatChip) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: "oklch(0.93 0.01 150)",
      border: "1px solid oklch(0.87 0.02 150)",
      borderRadius: 4, padding: "1px 5px",
      fontSize: "0.62rem", fontFamily: "Oswald, sans-serif",
      letterSpacing: "0.04em",
    }}>
      <span style={{ color: "oklch(0.55 0.04 150)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "oklch(0.22 0.06 150)", fontWeight: 700 }}>{value}</span>
    </span>
  );
}

// ── Single player cell (left or right side) ───────────────────────────────────
function PlayerCell({ player, side }: { player: SlotPlayer | null; side: "home" | "away" }) {
  if (!player) {
    return (
      <div style={{ flex: 1, padding: "0.6rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.7rem", color: "oklch(0.7 0.03 150)", fontStyle: "italic" }}>—</span>
      </div>
    );
  }

  const isHome = side === "home";
  const hasScored = player.pts > 0;

  return (
    <div style={{
      flex: 1,
      padding: "0.55rem 0.5rem",
      display: "flex",
      flexDirection: "column",
      alignItems: isHome ? "flex-start" : "flex-end",
      gap: "0.25rem",
      minWidth: 0,
    }}>
      {/* Row 1: avatar + name + pts */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        width: "100%",
        flexDirection: isHome ? "row" : "row-reverse",
      }}>
        <PlayerAvatar name={player.fullName} size={34} />
        <div style={{ flex: 1, minWidth: 0, textAlign: isHome ? "left" : "right" }}>
          <div style={{
            fontFamily: "Oswald, sans-serif", fontWeight: 700,
            fontSize: "0.82rem", color: "#1a3a2a",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {player.name}
          </div>
          <div style={{
            fontSize: "0.65rem", color: "oklch(0.5 0.04 150)",
            fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em",
          }}>
            {player.pos}– {player.nflTeam}
            {player.isTE && (
              <span style={{
                marginLeft: 3, fontSize: "0.58rem",
                color: "oklch(0.55 0.14 85)", fontWeight: 700,
                background: "oklch(0.97 0.08 85)", padding: "0px 3px", borderRadius: 2,
              }}>1.5×</span>
            )}
          </div>
        </div>
        {/* Points — big orange */}
        <div style={{ textAlign: isHome ? "right" : "left", flexShrink: 0 }}>
          <div style={{
            fontFamily: "Oswald, sans-serif", fontWeight: 800,
            fontSize: "1.15rem", lineHeight: 1,
            color: hasScored ? "#e07b00" : "oklch(0.7 0.03 150)",
          }}>
            {player.pts.toFixed(2).replace(/\.?0+$/, p => p === "" ? "" : p)}
            <sup style={{ fontSize: "0.55rem", fontWeight: 700, color: "oklch(0.55 0.12 85)" }}>
              .{String(Math.round(player.pts * 100) % 100).padStart(2, "0")}
            </sup>
          </div>
          <div style={{ fontSize: "0.6rem", color: "oklch(0.6 0.04 150)", textAlign: "center" }}>
            {player.pts.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Row 2: game info chip */}
      {player.gameInfo && (
        <div style={{
          fontSize: "0.62rem", color: "oklch(0.45 0.04 150)",
          background: "oklch(0.93 0.01 150)",
          border: "1px solid oklch(0.88 0.015 150)",
          borderRadius: 4, padding: "1px 6px",
          fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em",
          alignSelf: isHome ? "flex-start" : "flex-end",
        }}>
          {player.gameInfo}
        </div>
      )}

      {/* Row 3: stat chips */}
      {player.stats.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.2rem",
          justifyContent: isHome ? "flex-start" : "flex-end",
        }}>
          {player.stats.map((s, i) => <Chip key={i} label={s.label} value={s.value} />)}
        </div>
      )}
    </div>
  );
}

// ── Slot row (one row in the comparison grid) ─────────────────────────────────
function SlotRowComp({ row }: { row: SlotRow }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "stretch",
      borderBottom: "1px solid oklch(0.92 0.005 150)",
      background: "white",
    }}>
      <PlayerCell player={row.home} side="home" />

      {/* Center position label */}
      <div style={{
        width: 32, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "oklch(0.96 0.01 150)",
        borderLeft: "1px solid oklch(0.9 0.005 150)",
        borderRight: "1px solid oklch(0.9 0.005 150)",
      }}>
        <span style={{
          fontFamily: "Oswald, sans-serif", fontWeight: 700,
          fontSize: "0.6rem", letterSpacing: "0.06em",
          color: "oklch(0.45 0.06 150)",
          writingMode: "vertical-rl",
          textTransform: "uppercase",
          transform: "rotate(180deg)",
        }}>
          {row.slotLabel}
        </span>
      </div>

      <PlayerCell player={row.away} side="away" />
    </div>
  );
}

// ── Matchup detail view (the main expanded view) ──────────────────────────────
function MatchupDetail({ matchup }: { matchup: Matchup }) {
  const homeWinning = matchup.home.score > matchup.away.score;
  const homeTotal = matchup.home.score + matchup.away.score;
  const homePct = homeTotal > 0 ? (matchup.home.score / homeTotal) * 100 : 50;

  return (
    <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
      {/* Challenge banner */}
      {matchup.isChallenge && (
        <div style={{
          background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))",
          color: "oklch(0.15 0.02 150)",
          fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          padding: "0.3rem 0.75rem", textAlign: "center",
        }}>
          ⚔️ Challenge Game
        </div>
      )}

      {/* Score header */}
      <div style={{ padding: "0.75rem 1rem 0", background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          {/* Home side */}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <PlayerAvatar name={matchup.home.team} size={44} />
            <div>
              <div style={{
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem",
                color: homeWinning ? "#1a3a2a" : "oklch(0.55 0.04 150)", lineHeight: 1,
              }}>
                {matchup.home.score.toFixed(1)}
                <sup style={{ fontSize: "0.8rem", fontWeight: 600, color: "oklch(0.55 0.12 85)" }}>
                  .{String(Math.round(matchup.home.score * 100) % 100).padStart(2, "0")}
                </sup>
              </div>
              <div style={{
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                color: "#1a6b3a", marginTop: 2,
              }}>
                {matchup.home.team}
              </div>
              <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                {matchup.home.score.toFixed(2)}
              </div>
              {/* Players played */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: "0.65rem", color: "oklch(0.5 0.04 150)" }}>
                <span>👥 {matchup.home.playersPlayed} 0 0</span>
                <span>⏱ 0</span>
              </div>
            </div>
          </div>

          {/* Away side */}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: "0.5rem", flexDirection: "row-reverse" }}>
            <PlayerAvatar name={matchup.away.team} size={44} />
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem",
                color: !homeWinning ? "#1a3a2a" : "oklch(0.55 0.04 150)", lineHeight: 1,
              }}>
                {matchup.away.score.toFixed(1)}
                <sup style={{ fontSize: "0.8rem", fontWeight: 600, color: "oklch(0.55 0.12 85)" }}>
                  .{String(Math.round(matchup.away.score * 100) % 100).padStart(2, "0")}
                </sup>
              </div>
              <div style={{
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                color: "#1a6b3a", marginTop: 2,
              }}>
                {matchup.away.team}
              </div>
              <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                {matchup.away.score.toFixed(2)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", justifyContent: "flex-end" }}>
                <span>👥 {matchup.away.playersPlayed} 0 0</span>
                <span>⏱ 0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ flex: 1, height: 6, background: "oklch(0.9 0.005 150)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${homePct}%`,
              background: "linear-gradient(90deg, #2a7a3a, #3a9a4a)",
              borderRadius: 3, transition: "width 0.5s",
            }} />
          </div>
          <span style={{ fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", flexShrink: 0, fontFamily: "Oswald, sans-serif" }}>
            {homePct.toFixed(0)}%
          </span>
          <span style={{ fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", flexShrink: 0, fontFamily: "Oswald, sans-serif" }}>
            {(100 - homePct).toFixed(0)}%
          </span>
          <div style={{ flex: 1, height: 6, background: "oklch(0.9 0.005 150)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${100 - homePct}%`,
              background: "linear-gradient(90deg, #3a9a4a, #2a7a3a)",
              borderRadius: 3, float: "right", transition: "width 0.5s",
            }} />
          </div>
        </div>

        {/* OFFENSE label */}
        <div style={{
          textAlign: "center", marginTop: "0.5rem", marginBottom: 0,
          fontFamily: "Oswald, sans-serif", fontWeight: 700,
          fontSize: "0.72rem", letterSpacing: "0.12em",
          color: "oklch(0.45 0.04 150)", textTransform: "uppercase",
          borderTop: "1px solid oklch(0.9 0.005 150)",
          paddingTop: "0.4rem",
        }}>
          OFFENSE
        </div>
      </div>

      {/* Slot-by-slot comparison */}
      <div>
        {matchup.slots.map((row, i) => (
          <SlotRowComp key={i} row={row} />
        ))}
      </div>
    </div>
  );
}

// ── Matchup selector pill ─────────────────────────────────────────────────────
function MatchupPill({ matchup, active, onClick }: { matchup: Matchup; active: boolean; onClick: () => void }) {
  const homeWinning = matchup.home.score > matchup.away.score;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.3rem 0.65rem",
        background: active ? "white" : "rgba(255,255,255,0.12)",
        border: active ? "2px solid oklch(0.78 0.15 85)" : "1.5px solid rgba(255,255,255,0.2)",
        borderRadius: 20, cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      <PlayerAvatar name={matchup.home.team} size={22} />
      <span style={{
        fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
        color: active ? "#1a3a2a" : "white",
      }}>
        {matchup.home.score.toFixed(1)}
      </span>
      <span style={{ fontSize: "0.7rem", color: active ? "oklch(0.5 0.04 150)" : "rgba(255,255,255,0.6)" }}>vs</span>
      <span style={{
        fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
        color: active ? "#1a3a2a" : "white",
      }}>
        {matchup.away.score.toFixed(1)}
      </span>
      <PlayerAvatar name={matchup.away.team} size={22} />
      {matchup.isChallenge && (
        <span style={{ fontSize: "0.65rem" }}>⚔️</span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveScoring() {
  const { franchise } = useAuth();
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeId, setActiveId] = useState(1);

  const refresh = useCallback(() => {
    setLastRefresh(new Date());
    setCountdown(REFRESH_SECONDS);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refresh(); return REFRESH_SECONDS; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const activeMatchup = MOCK_MATCHUPS.find(m => m.id === activeId) ?? MOCK_MATCHUPS[0];

  const tickerMessages = [
    "🔴 LIVE — Week 14 Scoring in Progress",
    "⚔️ CHALLENGE GAME: Team Gidley 202.7 vs. Team Pattie 141.48",
    "📊 LEAGUE MEDIAN: 90.3 pts — 6 teams above, 6 below",
  ];

  return (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={true} tickerMessages={tickerMessages} teamName={franchise?.team_name} />

      {/* Matchup selector bar */}
      <div style={{
        position: "sticky", top: 56, zIndex: 50,
        background: "rgba(15,35,20,0.92)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "0.5rem 1rem",
        display: "flex", alignItems: "center", gap: "0.5rem",
        overflowX: "auto",
      }}>
        {MOCK_MATCHUPS.map(m => (
          <MatchupPill key={m.id} matchup={m} active={m.id === activeId} onClick={() => setActiveId(m.id)} />
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.35rem",
            background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.3rem 0.6rem",
          }}>
            <Clock size={12} color="rgba(255,255,255,0.7)" />
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", letterSpacing: "0.04em" }}>{timeStr}</span>
          </div>
          <button onClick={refresh} style={{
            background: "oklch(0.28 0.09 150)", border: "none", borderRadius: 8,
            padding: "0.3rem 0.6rem", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.3rem",
            fontFamily: "Oswald, sans-serif", fontSize: "0.75rem",
          }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Page title */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 1rem 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: "white", letterSpacing: "0.04em", margin: 0 }}>
              LIVE SCORING
            </h1>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
              Week 14 · Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Active matchup detail */}
        <MatchupDetail matchup={activeMatchup} />

        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", textAlign: "center", marginTop: "1rem", paddingBottom: "2rem" }}>
          Tap a matchup above to switch · Auto-refreshes every 5 minutes
        </p>
      </div>
    </div>
  );
}
