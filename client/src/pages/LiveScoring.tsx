/**
 * WRC Fantasy Football - Live Scoring Page
 * Layout matches reference: matchup selector bar → two-column score header with
 * progress bars → slot-by-slot player comparison with position label in center divider.
 * Player headshot placeholder, large orange fantasy pts, stat chips below each player.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { RefreshCw, Clock, Wifi, Swords } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import TeamLogo from "@/components/TeamLogo";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, OWNER_TO_TEAM, getCurrentWeek } from "@/lib/scheduleData2026";
import { useNFLMatchups, formatGameTime } from "@/hooks/useNFLMatchups";
import { useNFLGameStatus, minutesRemainingInGame, type NFLGameStatusMap } from "@/hooks/useNFLGameStatus";
import { normalizeNFLTeamCode as normalizeNFLTeam } from "@shared/nflTeamCodes";
import { useNFLLiveScores, getLivePoints, getLiveStats } from "@/hooks/useNFLLiveScores";
import { buildStatChips } from "@/lib/scoringEngine";
import { useNFLProjections, getProjectedPoints } from "@/hooks/useNFLProjections";
import { useNFLInjuries, getInjuryDesignation, getInjuryColor, getInjuryLabel } from "@/hooks/useNFLInjuries";
import { fetchPlayerByName } from "@/hooks/useTank01Player";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { buildDefaultStarters } from "@/lib/defaultLineup";
import { useDraftPlayerUniverse } from "@/hooks/useDraftPlayerUniverse";
import { formatKickerEvent, getKickerEventsForPlayer, type KickerPlayEvent } from "@/lib/espnKickerEvents";

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
  kickerEvents?: KickerPlayEvent[];
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
  projectedFinal: number;
  playersPlayed: number;
  playersPlaying: number;
  playersYetToPlay: number;
  minutesRemaining: number;
  playersTotal: number;
  logo?: string;
};

type BenchPlayer = SlotPlayer & { slot: "BN" };

type Matchup = {
  id: number;
  week: number;
  isChallenge: boolean;
  home: TeamSide;
  away: TeamSide;
  slots: SlotRow[];
  bench: { home: BenchPlayer[]; away: BenchPlayer[] };
};

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_MATCHUPS: Matchup[] = [
  {
    id: 1, week: 1, isChallenge: false,
    home: { team: "The Super Snuffleupagus", owner: "Jonas", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: "HamSandwich", owner: "Keith", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "G. Edwards", fullName: "Gus Edwards", pos: "RB", nflTeam: "LAC", pts: 8.4, proj: 8.4, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "YDS", value: 54 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "M. Brown", fullName: "Marquise Brown", pos: "WR", nflTeam: "KC", pts: 4.2, proj: 4.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 22 }] },
        { slot: "BN", name: "T. McBride", fullName: "Trey McBride", pos: "TE", nflTeam: "ARI", pts: 9.6, proj: 9.6, isTE: true, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 36 }] },
        { slot: "BN", name: "J. Love", fullName: "Jordan Love", pos: "QB", nflTeam: "GB", pts: 14.2, proj: 14.2, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "J. Warren", fullName: "Jaylen Warren", pos: "RB", nflTeam: "PIT", pts: 6.8, proj: 6.8, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "YDS", value: 38 }, { label: "REC", value: 2 }] },
        { slot: "BN", name: "D. Wicks", fullName: "Dontayvion Wicks", pos: "WR", nflTeam: "GB", pts: 3.2, proj: 3.2, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "E. McPherson", fullName: "Evan McPherson", pos: "K", nflTeam: "CIN", pts: 7.0, proj: 7.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "1/1" }] },
        { slot: "BN", name: "J. Allen (BUF DST)", fullName: "Buffalo Bills DST", pos: "DST", nflTeam: "BUF", pts: 4.0, proj: 4.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "SACK", value: 1 }] },
      ],
      away: [
        { slot: "BN", name: "A. Cooper", fullName: "Amari Cooper", pos: "WR", nflTeam: "CLE", pts: 5.4, proj: 5.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 44 }] },
        { slot: "BN", name: "Z. Moss", fullName: "Zack Moss", pos: "RB", nflTeam: "IND", pts: 3.6, proj: 3.6, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 26 }] },
        { slot: "BN", name: "L. Musgrave", fullName: "Luke Musgrave", pos: "TE", nflTeam: "GB", pts: 4.8, proj: 4.8, isTE: true, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "D. Ridder", fullName: "Desmond Ridder", pos: "QB", nflTeam: "ARI", pts: 8.2, proj: 8.2, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 148 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "T. Spears", fullName: "Tyjae Spears", pos: "RB", nflTeam: "TEN", pts: 5.4, proj: 5.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 34 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "R. Shaheed", fullName: "Rashid Shaheed", pos: "WR", nflTeam: "NO", pts: 6.2, proj: 6.2, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 42 }] },
        { slot: "BN", name: "C. Boswell", fullName: "Chris Boswell", pos: "K", nflTeam: "PIT", pts: 9.0, proj: 9.0, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "3/3" }] },
        { slot: "BN", name: "C. Hubbard", fullName: "Chuba Hubbard", pos: "RB", nflTeam: "CAR", pts: 7.8, proj: 7.8, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 58 }, { label: "REC", value: 1 }] },
      ],
    },
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
    id: 2, week: 1, isChallenge: false,
    home: { team: "The Boys of Fall", owner: "David R.", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: "Millertime", owner: "Scott N.", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "R. White", fullName: "Rachaad White", pos: "RB", nflTeam: "TB", pts: 6.4, proj: 6.4, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "YDS", value: 44 }] },
        { slot: "BN", name: "O. Beckham", fullName: "Odell Beckham Jr.", pos: "WR", nflTeam: "MIA", pts: 4.8, proj: 4.8, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] },
        { slot: "BN", name: "D. Kincaid", fullName: "Dalton Kincaid", pos: "TE", nflTeam: "BUF", pts: 3.2, proj: 3.2, isTE: true, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "S. Howell", fullName: "Sam Howell", pos: "QB", nflTeam: "SEA", pts: 0, proj: 12.4, gameInfo: "SEA 27 @ CAR 10 F", stats: [] },
        { slot: "BN", name: "Z. Moss", fullName: "Zack Moss", pos: "RB", nflTeam: "IND", pts: 3.6, proj: 3.6, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 26 }] },
        { slot: "BN", name: "D. Slayton", fullName: "Darius Slayton", pos: "WR", nflTeam: "NYG", pts: 5.2, proj: 5.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 32 }] },
        { slot: "BN", name: "B. Aubrey", fullName: "Brandon Aubrey", pos: "K", nflTeam: "DAL", pts: 8.0, proj: 8.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] },
        { slot: "BN", name: "NYG DST", fullName: "New York Giants DST", pos: "DST", nflTeam: "NYG", pts: 2.0, proj: 2.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [] },
      ],
      away: [
        { slot: "BN", name: "D. Singletary", fullName: "Devin Singletary", pos: "RB", nflTeam: "NYG", pts: 4.2, proj: 4.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 32 }] },
        { slot: "BN", name: "D. Mooney", fullName: "Darnell Mooney", pos: "WR", nflTeam: "ATL", pts: 5.8, proj: 5.8, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 38 }] },
        { slot: "BN", name: "D. Knox", fullName: "Dawson Knox", pos: "TE", nflTeam: "BUF", pts: 2.4, proj: 2.4, isTE: true, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 1 }, { label: "YDS", value: 9 }] },
        { slot: "BN", name: "T. DeVito", fullName: "Tommy DeVito", pos: "QB", nflTeam: "NYG", pts: 6.8, proj: 6.8, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 148 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "Z. Moss", fullName: "Zack Moss", pos: "RB", nflTeam: "IND", pts: 3.6, proj: 3.6, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 26 }] },
        { slot: "BN", name: "Q. Johnston", fullName: "Quentin Johnston", pos: "WR", nflTeam: "LAC", pts: 4.4, proj: 4.4, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 24 }] },
        { slot: "BN", name: "E. Pineiro", fullName: "Eddy Pineiro", pos: "K", nflTeam: "CAR", pts: 3.0, proj: 3.0, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "FG", value: "0/1" }, { label: "XP", value: "3/3" }] },
        { slot: "BN", name: "CLE DST", fullName: "Cleveland Browns DST", pos: "DST", nflTeam: "CLE", pts: 10.2, proj: 10.2, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] },
      ],
    },
    slots: [
      { slotLabel: "QB", home: { name: "P. Mahomes", fullName: "Patrick Mahomes", pos: "QB", nflTeam: "KC", pts: 28.4, proj: 28.4, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 312 }, { label: "TD", value: 3 }] }, away: { name: "T. Lawrence", fullName: "Trevor Lawrence", pos: "QB", nflTeam: "JAC", pts: 18.2, proj: 18.2, gameInfo: "JAC 20 @ TEN 17 F", stats: [{ label: "YDS", value: 224 }, { label: "TD", value: 2 }] } },
      { slotLabel: "RB", home: { name: "C. McCaffrey", fullName: "Christian McCaffrey", pos: "RB", nflTeam: "SF", pts: 24.6, proj: 24.6, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 148 }, { label: "TD", value: 1 }, { label: "REC", value: 5 }] }, away: { name: "A. Ekeler", fullName: "Austin Ekeler", pos: "RB", nflTeam: "WAS", pts: 14.2, proj: 14.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 72 }, { label: "REC", value: 4 }, { label: "YDS", value: 30 }] } },
      { slotLabel: "RB", home: { name: "S. Barkley", fullName: "Saquon Barkley", pos: "RB", nflTeam: "PHI", pts: 18.8, proj: 18.8, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 108 }, { label: "TD", value: 1 }] }, away: { name: "J. Gibbs", fullName: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", pts: 16.4, proj: 16.4, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 94 }, { label: "REC", value: 3 }, { label: "YDS", value: 20 }] } },
      { slotLabel: "WR", home: { name: "T. Hill", fullName: "Tyreek Hill", pos: "WR", nflTeam: "MIA", pts: 14.2, proj: 14.2, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "REC", value: 7 }, { label: "YDS", value: 92 }] }, away: { name: "D. Samuel", fullName: "Deebo Samuel", pos: "WR", nflTeam: "SF", pts: 9.8, proj: 9.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 68 }] } },
      { slotLabel: "WR", home: { name: "C. Lamb", fullName: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", pts: 8.6, proj: 8.6, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 56 }] }, away: { name: "C. Olave", fullName: "Chris Olave", pos: "WR", nflTeam: "NO", pts: 11.4, proj: 11.4, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 6 }, { label: "YDS", value: 84 }] } },
      { slotLabel: "TE", home: { name: "T. Kelce", fullName: "Travis Kelce", pos: "TE", nflTeam: "KC", pts: 9.0, proj: 9.0, isTE: true, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 40 }] }, away: { name: "E. Engram", fullName: "Evan Engram", pos: "TE", nflTeam: "JAC", pts: 8.2, proj: 8.2, isTE: true, gameInfo: "JAC 20 @ TEN 17 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 32 }] } },
      { slotLabel: "SFLEX", home: { name: "D. Prescott", fullName: "Dak Prescott", pos: "QB", nflTeam: "DAL", pts: 14.2, proj: 14.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "YDS", value: 307 }, { label: "TD", value: 2 }] }, away: { name: "G. Smith", fullName: "Geno Smith", pos: "QB", nflTeam: "SEA", pts: 12.6, proj: 12.6, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 248 }, { label: "TD", value: 2 }] } },
      { slotLabel: "FLEX", home: { name: "R. Stevenson", fullName: "Rhamondre Stevenson", pos: "RB", nflTeam: "NE", pts: 8.4, proj: 8.4, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "YDS", value: 64 }, { label: "REC", value: 2 }] }, away: { name: "K. Hunt", fullName: "Kareem Hunt", pos: "RB", nflTeam: "CLE", pts: 6.8, proj: 6.8, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "YDS", value: 48 }, { label: "REC", value: 2 }] } },
      { slotLabel: "K", home: { name: "T. Bass", fullName: "Tyler Bass", pos: "K", nflTeam: "BUF", pts: 8.0, proj: 8.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] }, away: { name: "D. Hopkins", fullName: "Dustin Hopkins", pos: "K", nflTeam: "CLE", pts: 6.0, proj: 6.0, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "FG", value: "1/2" }, { label: "XP", value: "3/3" }] } },
      { slotLabel: "DST", home: { name: "Dallas", fullName: "Dallas Cowboys", pos: "DST", nflTeam: "DAL", pts: 7.0, proj: 7.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }] }, away: { name: "Cleveland", fullName: "Cleveland Browns", pos: "DST", nflTeam: "CLE", pts: 10.2, proj: 10.2, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] } },
    ],
  },
  {
    id: 3, week: 1, isChallenge: false,
    home: { team: "Heiden's Hardtimes", owner: "Jason", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: "Billy Goats Gruff", owner: "Bill", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "S. Perine", fullName: "Samaje Perine", pos: "RB", nflTeam: "DEN", pts: 4.2, proj: 4.2, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "YDS", value: 28 }] },
        { slot: "BN", name: "T. Atwell", fullName: "Tutu Atwell", pos: "WR", nflTeam: "LAR", pts: 3.6, proj: 3.6, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 16 }] },
        { slot: "BN", name: "I. Smith Jr.", fullName: "Irv Smith Jr.", pos: "TE", nflTeam: "CIN", pts: 5.4, proj: 5.4, isTE: true, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 24 }] },
        { slot: "BN", name: "H. Hooker", fullName: "Hendon Hooker", pos: "QB", nflTeam: "DET", pts: 0, proj: 8.4, gameInfo: "DET 10 @ MIN 23 F", stats: [] },
        { slot: "BN", name: "K. Vidal", fullName: "Kimani Vidal", pos: "RB", nflTeam: "LAC", pts: 3.8, proj: 3.8, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "YDS", value: 24 }] },
        { slot: "BN", name: "K. Raymond", fullName: "Kalif Raymond", pos: "WR", nflTeam: "DET", pts: 2.4, proj: 2.4, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "REC", value: 1 }, { label: "YDS", value: 14 }] },
        { slot: "BN", name: "N. Folk", fullName: "Nick Folk", pos: "K", nflTeam: "TEN", pts: 4.0, proj: 4.0, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "1/1" }] },
        { slot: "BN", name: "KC DST", fullName: "Kansas City Chiefs DST", pos: "DST", nflTeam: "KC", pts: 0, proj: 8.4, gameInfo: "LV 14 @ KC 31 F", stats: [] },
      ],
      away: [
        { slot: "BN", name: "T. Chandler", fullName: "Ty Chandler", pos: "RB", nflTeam: "SF", pts: 4.8, proj: 4.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 34 }] },
        { slot: "BN", name: "J. Smith-Njigba", fullName: "Jaxon Smith-Njigba", pos: "WR", nflTeam: "SEA", pts: 6.2, proj: 6.2, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 42 }] },
        { slot: "BN", name: "C. Otton", fullName: "Cade Otton", pos: "TE", nflTeam: "TB", pts: 4.8, proj: 4.8, isTE: true, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "W. Levis", fullName: "Will Levis", pos: "QB", nflTeam: "TEN", pts: 0, proj: 10.4, gameInfo: "TEN 17 @ IND 24 F", stats: [] },
        { slot: "BN", name: "C. Edwards-Helaire", fullName: "Clyde Edwards-Helaire", pos: "RB", nflTeam: "KC", pts: 5.2, proj: 5.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 32 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "E. Moore", fullName: "Elijah Moore", pos: "WR", nflTeam: "CLE", pts: 3.4, proj: 3.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 14 }] },
        { slot: "BN", name: "C. Santos", fullName: "Cairo Santos", pos: "K", nflTeam: "CHI", pts: 5.0, proj: 5.0, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] },
        { slot: "BN", name: "PHI DST", fullName: "Philadelphia Eagles DST", pos: "DST", nflTeam: "PHI", pts: 5.0, proj: 5.0, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "SACK", value: 2 }] },
      ],
    },
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
    id: 4, week: 1, isChallenge: false,
    home: { team: "The Four Horsemen", owner: "Jamie", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: "Legion of Doom", owner: "Dan", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "D. Pierce", fullName: "Dameon Pierce", pos: "RB", nflTeam: "HOU", pts: 5.4, proj: 5.4, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "YDS", value: 34 }] },
        { slot: "BN", name: "D. Slayton", fullName: "Darius Slayton", pos: "WR", nflTeam: "NYG", pts: 4.2, proj: 4.2, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 22 }] },
        { slot: "BN", name: "N. Fant", fullName: "Noah Fant", pos: "TE", nflTeam: "SEA", pts: 3.8, proj: 3.8, isTE: true, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "A. O'Connell", fullName: "Aidan O'Connell", pos: "QB", nflTeam: "LV", pts: 4.2, proj: 4.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 98 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "P. Taylor", fullName: "Patrick Taylor", pos: "RB", nflTeam: "MIA", pts: 3.6, proj: 3.6, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "YDS", value: 24 }] },
        { slot: "BN", name: "M. Valdes-Scantling", fullName: "Marquez Valdes-Scantling", pos: "WR", nflTeam: "BUF", pts: 2.8, proj: 2.8, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "REC", value: 1 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "B. Aubrey", fullName: "Brandon Aubrey", pos: "K", nflTeam: "DAL", pts: 8.0, proj: 8.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] },
        { slot: "BN", name: "DEN DST", fullName: "Denver Broncos DST", pos: "DST", nflTeam: "DEN", pts: 6.0, proj: 6.0, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }] },
      ],
      away: [
        { slot: "BN", name: "R. Johnson", fullName: "Roschon Johnson", pos: "RB", nflTeam: "CHI", pts: 6.8, proj: 6.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 2 }] },
        { slot: "BN", name: "C. Tillman", fullName: "Cedric Tillman", pos: "WR", nflTeam: "CLE", pts: 3.4, proj: 3.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 14 }] },
        { slot: "BN", name: "J. Johnson", fullName: "Juwan Johnson", pos: "TE", nflTeam: "NO", pts: 4.2, proj: 4.2, isTE: true, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "A. O'Connell", fullName: "Aidan O'Connell", pos: "QB", nflTeam: "LV", pts: 4.2, proj: 4.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 98 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "K. Mitchell", fullName: "Keaton Mitchell", pos: "RB", nflTeam: "BAL", pts: 5.6, proj: 5.6, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "YDS", value: 36 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "M. Mims Jr.", fullName: "Marvin Mims Jr.", pos: "WR", nflTeam: "DEN", pts: 3.2, proj: 3.2, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "W. Lutz", fullName: "Wil Lutz", pos: "K", nflTeam: "DEN", pts: 4.0, proj: 4.0, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "1/1" }] },
        { slot: "BN", name: "NYJ DST", fullName: "New York Jets DST", pos: "DST", nflTeam: "NYJ", pts: 7.2, proj: 7.2, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }] },
      ],
    },
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
    id: 5, week: 1, isChallenge: false,
    home: { team: "Xavier Musketeers", owner: "Scott M.", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: "Legends", owner: "David S.", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "J. Waddle", fullName: "Jaylen Waddle", pos: "WR", nflTeam: "MIA", pts: 6.2, proj: 6.2, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 42 }] },
        { slot: "BN", name: "T. Pollard", fullName: "Tony Pollard", pos: "RB", nflTeam: "TEN", pts: 12.4, proj: 12.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 84 }, { label: "REC", value: 2 }] },
        { slot: "BN", name: "M. Andrews", fullName: "Mark Andrews", pos: "TE", nflTeam: "BAL", pts: 8.4, proj: 8.4, isTE: true, gameInfo: "BAL 41 @ GB 24 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 34 }] },
        { slot: "BN", name: "S. Darnold", fullName: "Sam Darnold", pos: "QB", nflTeam: "MIN", pts: 0, proj: 14.2, gameInfo: "DET 10 @ MIN 23 F", stats: [] },
        { slot: "BN", name: "R. Mostert", fullName: "Raheem Mostert", pos: "RB", nflTeam: "MIA", pts: 7.2, proj: 7.2, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "YDS", value: 52 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "B. Cooks", fullName: "Brandin Cooks", pos: "WR", nflTeam: "DAL", pts: 4.8, proj: 4.8, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] },
        { slot: "BN", name: "Y. Koo", fullName: "Younghoe Koo", pos: "K", nflTeam: "ATL", pts: 7.0, proj: 7.0, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "4/4" }] },
        { slot: "BN", name: "MIA DST", fullName: "Miami Dolphins DST", pos: "DST", nflTeam: "MIA", pts: 4.0, proj: 4.0, gameInfo: "MIA 28 @ NE 10 F", stats: [{ label: "SACK", value: 1 }, { label: "INT", value: 1 }] },
      ],
      away: [
        { slot: "BN", name: "N. Harris", fullName: "Najee Harris", pos: "RB", nflTeam: "PIT", pts: 8.4, proj: 8.4, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "YDS", value: 54 }, { label: "REC", value: 2 }] },
        { slot: "BN", name: "S. Moore", fullName: "Skyy Moore", pos: "WR", nflTeam: "KC", pts: 3.2, proj: 3.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "C. Okonkwo", fullName: "Chigoziem Okonkwo", pos: "TE", nflTeam: "TEN", pts: 4.8, proj: 4.8, isTE: true, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "B. Young", fullName: "Bryce Young", pos: "QB", nflTeam: "CAR", pts: 14.8, proj: 14.8, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 198 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "T. Chandler", fullName: "Ty Chandler", pos: "RB", nflTeam: "SF", pts: 4.8, proj: 4.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 34 }] },
        { slot: "BN", name: "D. Robinson", fullName: "Demarcus Robinson", pos: "WR", nflTeam: "LAR", pts: 3.6, proj: 3.6, gameInfo: "LAR 24 @ ATL 27 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 16 }] },
        { slot: "BN", name: "M. Gay", fullName: "Matt Gay", pos: "K", nflTeam: "IND", pts: 6.0, proj: 6.0, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "3/3" }] },
        { slot: "BN", name: "PIT DST", fullName: "Pittsburgh Steelers DST", pos: "DST", nflTeam: "PIT", pts: 9.4, proj: 9.4, gameInfo: "HOU 24 @ PIT 20 F", stats: [{ label: "SACK", value: 3 }, { label: "INT", value: 1 }] },
      ],
    },
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
    id: 6, week: 1, isChallenge: false,
    home: { team: "Vipers", owner: "Shawn", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    away: { team: 'Larry "Bud" Melman123', owner: "Greg", score: 0, projected: 0, projectedFinal: 0, playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 10, minutesRemaining: 600, playersTotal: 10 },
    bench: {
      home: [
        { slot: "BN", name: "R. White", fullName: "Rachaad White", pos: "RB", nflTeam: "TB", pts: 6.4, proj: 6.4, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "YDS", value: 44 }] },
        { slot: "BN", name: "T. McLaurin", fullName: "Terry McLaurin", pos: "WR", nflTeam: "WAS", pts: 7.8, proj: 7.8, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 5 }, { label: "YDS", value: 58 }] },
        { slot: "BN", name: "T. Hill (TE)", fullName: "Taysom Hill", pos: "TE", nflTeam: "NO", pts: 4.2, proj: 4.2, isTE: true, gameInfo: "NO 24 @ TB 17 F", stats: [{ label: "REC", value: 1 }, { label: "RUSH", value: 22 }] },
        { slot: "BN", name: "G. Minshew", fullName: "Gardner Minshew", pos: "QB", nflTeam: "LV", pts: 8.4, proj: 8.4, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "YDS", value: 148 }, { label: "TD", value: 1 }] },
        { slot: "BN", name: "C. Hubbard", fullName: "Chuba Hubbard", pos: "RB", nflTeam: "CAR", pts: 7.8, proj: 7.8, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 58 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "J. Dotson", fullName: "Jahan Dotson", pos: "WR", nflTeam: "WAS", pts: 7.4, proj: 7.4, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 54 }] },
        { slot: "BN", name: "M. Badgley", fullName: "Michael Badgley", pos: "K", nflTeam: "IND", pts: 5.0, proj: 5.0, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] },
        { slot: "BN", name: "WAS DST", fullName: "Washington Commanders DST", pos: "DST", nflTeam: "WAS", pts: 3.0, proj: 3.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "SACK", value: 1 }] },
      ],
      away: [
        { slot: "BN", name: "D. Harris", fullName: "Damien Harris", pos: "RB", nflTeam: "BUF", pts: 6.4, proj: 6.4, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 44 }] },
        { slot: "BN", name: "P. Campbell", fullName: "Parris Campbell", pos: "WR", nflTeam: "NYG", pts: 3.8, proj: 3.8, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 18 }] },
        { slot: "BN", name: "T. Conklin", fullName: "Tyler Conklin", pos: "TE", nflTeam: "NYJ", pts: 4.2, proj: 4.2, isTE: true, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] },
        { slot: "BN", name: "M. Willis", fullName: "Malik Willis", pos: "QB", nflTeam: "TEN", pts: 8.4, proj: 8.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 124 }, { label: "RUSH", value: 44 }] },
        { slot: "BN", name: "E. Mitchell", fullName: "Elijah Mitchell", pos: "RB", nflTeam: "SF", pts: 4.8, proj: 4.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 28 }, { label: "REC", value: 1 }] },
        { slot: "BN", name: "J. Reynolds", fullName: "Josh Reynolds", pos: "WR", nflTeam: "DET", pts: 4.4, proj: 4.4, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 24 }] },
        { slot: "BN", name: "T. Vizcaino", fullName: "Tristan Vizcaino", pos: "K", nflTeam: "WAS", pts: 5.0, proj: 5.0, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] },
        { slot: "BN", name: "ARI DST", fullName: "Arizona Cardinals DST", pos: "DST", nflTeam: "ARI", pts: 14.0, proj: 14.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] },
      ],
    },
    slots: [
      { slotLabel: "QB", home: { name: "K. Murray", fullName: "Kyler Murray", pos: "QB", nflTeam: "ARI", pts: 14.2, proj: 14.2, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] }, away: { name: "K. Murray", fullName: "Kyler Murray", pos: "QB", nflTeam: "ARI", pts: 14.2, proj: 14.2, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 184 }, { label: "TD", value: 1 }] } },
      { slotLabel: "RB", home: { name: "J. Conner", fullName: "James Conner", pos: "RB", nflTeam: "ARI", pts: 8.4, proj: 8.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 2 }] }, away: { name: "J. Conner", fullName: "James Conner", pos: "RB", nflTeam: "ARI", pts: 8.4, proj: 8.4, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "YDS", value: 44 }, { label: "REC", value: 2 }] } },
      { slotLabel: "RB", home: { name: "M. Sanders", fullName: "Miles Sanders", pos: "RB", nflTeam: "CAR", pts: 6.2, proj: 6.2, gameInfo: "SEA 27 @ CAR 10 F", stats: [{ label: "YDS", value: 32 }, { label: "REC", value: 2 }] }, away: { name: "C. Akers", fullName: "Cam Akers", pos: "RB", nflTeam: "MIN", pts: 9.8, proj: 9.8, gameInfo: "DET 10 @ MIN 23 F", stats: [{ label: "YDS", value: 58 }, { label: "REC", value: 2 }, { label: "YDS", value: 20 }] } },
      { slotLabel: "WR", home: { name: "Z. Jones", fullName: "Zay Jones", pos: "WR", nflTeam: "ARI", pts: 4.8, proj: 4.8, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] }, away: { name: "Z. Jones", fullName: "Zay Jones", pos: "WR", nflTeam: "ARI", pts: 4.8, proj: 4.8, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] } },
      { slotLabel: "WR", home: { name: "J. Dotson", fullName: "Jahan Dotson", pos: "WR", nflTeam: "WAS", pts: 7.4, proj: 7.4, gameInfo: "DAL 30 @ WAS 23 F", stats: [{ label: "REC", value: 4 }, { label: "YDS", value: 54 }] }, away: { name: "K. Toney", fullName: "Kadarius Toney", pos: "WR", nflTeam: "KC", pts: 5.2, proj: 5.2, gameInfo: "LV 14 @ KC 31 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 32 }] } },
      { slotLabel: "TE", home: { name: "G. Everett", fullName: "Gerald Everett", pos: "TE", nflTeam: "LAC", pts: 6.8, proj: 6.8, isTE: true, gameInfo: "LAC 27 @ DEN 14 F", stats: [{ label: "REC", value: 3 }, { label: "YDS", value: 28 }] }, away: { name: "T. Conklin", fullName: "Tyler Conklin", pos: "TE", nflTeam: "NYJ", pts: 4.2, proj: 4.2, isTE: true, gameInfo: "NE 42 @ NYJ 10 F", stats: [{ label: "REC", value: 2 }, { label: "YDS", value: 12 }] } },
      { slotLabel: "SFLEX", home: { name: "D. Watson", fullName: "Deshaun Watson", pos: "QB", nflTeam: "CLE", pts: 0, proj: 12.4, gameInfo: "CLE 21 @ BAL 28 F", stats: [] }, away: { name: "M. Willis", fullName: "Malik Willis", pos: "QB", nflTeam: "TEN", pts: 8.4, proj: 8.4, gameInfo: "TEN 17 @ IND 24 F", stats: [{ label: "YDS", value: 124 }, { label: "RUSH", value: 44 }] } },
      { slotLabel: "FLEX", home: { name: "D. Harris", fullName: "Damien Harris", pos: "RB", nflTeam: "BUF", pts: 6.4, proj: 6.4, gameInfo: "PHI 13 @ BUF 12 F", stats: [{ label: "YDS", value: 44 }] }, away: { name: "E. Mitchell", fullName: "Elijah Mitchell", pos: "RB", nflTeam: "SF", pts: 4.8, proj: 4.8, gameInfo: "CHI 38 @ SF 42 F", stats: [{ label: "YDS", value: 28 }, { label: "REC", value: 1 }] } },
      { slotLabel: "K", home: { name: "R. Patterson", fullName: "Riley Patterson", pos: "K", nflTeam: "JAC", pts: 8.0, proj: 8.0, gameInfo: "JAC 20 @ TEN 17 F", stats: [{ label: "FG", value: "2/2" }, { label: "XP", value: "2/2" }] }, away: { name: "T. Vizcaino", fullName: "Tristan Vizcaino", pos: "K", nflTeam: "WSH", pts: 5.0, proj: 5.0, gameInfo: "DAL 30 @ WSH 23 F", stats: [{ label: "FG", value: "1/1" }, { label: "XP", value: "2/2" }] } },
      { slotLabel: "DST", home: { name: "Arizona", fullName: "Arizona Cardinals", pos: "DST", nflTeam: "ARI", pts: 14.0, proj: 14.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] }, away: { name: "Arizona", fullName: "Arizona Cardinals", pos: "DST", nflTeam: "ARI", pts: 14.0, proj: 14.0, gameInfo: "ARI 14 @ CIN 37 F", stats: [{ label: "SACK", value: 2 }, { label: "INT", value: 1 }, { label: "TD", value: 1 }] } },
    ],
  },
];

// ── Headshot avatar with initials fallback ─────────────────────────────────────
function PlayerAvatar({ name, pos, size = 36 }: { name: string; pos: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [headshotFailed, setHeadshotFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHeadshotUrl(null);
    setHeadshotFailed(false);
    if (pos === "DST") return;
    fetchPlayerByName(name).then(player => {
      if (cancelled) return;
      setHeadshotUrl(player?.espnHeadshot || getEspnHeadshotUrl(player?.espnID));
    });
    return () => { cancelled = true; };
  }, [name, pos]);

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "oklch(0.88 0.03 150)",
      border: "1.5px solid oklch(0.78 0.06 150)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
      fontSize: size * 0.35, color: "oklch(0.32 0.09 150)",
      letterSpacing: "0.02em",
    }}>
      {headshotUrl && !headshotFailed ? (
        <img
          src={headshotUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setHeadshotFailed(true)}
        />
      ) : initials}
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
      fontSize: "0.62rem", fontFamily: "Barlow Condensed, sans-serif",
      letterSpacing: "0.04em",
    }}>
      <span style={{ color: "oklch(0.55 0.04 150)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "oklch(0.22 0.06 150)", fontWeight: 700 }}>{value}</span>
    </span>
  );
}

// ── Single player cell (left or right side) ───────────────────────────────────
function PlayerCell({ player, side, injuries = {} }: { player: SlotPlayer | null; side: "home" | "away"; injuries?: import("@/hooks/useNFLInjuries").InjuryMap }) {
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
        <PlayerAvatar name={player.fullName} pos={player.pos} size={34} />
          <div style={{ flex: 1, minWidth: 0, textAlign: isHome ? "left" : "right" }}>
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
              fontSize: "0.82rem", color: "#1a3a2a",
              display: "flex", alignItems: "center", gap: "0.3rem",
              flexDirection: isHome ? "row" : "row-reverse",
            }}>
              <a
                href={`/player/${encodeURIComponent(player.fullName || player.name)}`}
                style={{ color: "inherit", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.38 0.18 260)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#1a3a2a")}
              >{player.name}</a>
              {(() => {
                const designation = getInjuryDesignation(injuries, player.fullName);
                const injColor = designation ? getInjuryColor(designation) : null;
                if (!injColor) return null;
                return (
                  <span style={{
                    fontSize: "0.55rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                    padding: "1px 3px", borderRadius: 2, flexShrink: 0,
                    background: injColor.bg, color: injColor.text, border: `1px solid ${injColor.border}`,
                  }} title={designation}>{getInjuryLabel(designation)}</span>
                );
              })()}
            </div>
          <div style={{
            fontSize: "0.65rem", color: "oklch(0.5 0.04 150)",
            fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em",
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
            fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800,
            fontSize: "1.15rem", lineHeight: 1,
            color: hasScored ? "#e07b00" : "oklch(0.7 0.03 150)",
          }}>
            {player.pts.toFixed(1)}
          </div>
          <div style={{ fontSize: "0.6rem", color: "oklch(0.6 0.04 150)", textAlign: "center" }}>
            PROJ {player.proj.toFixed(1)}
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
          fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em",
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

      {player.pos === "K" && player.kickerEvents && player.kickerEvents.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", justifyContent: isHome ? "flex-start" : "flex-end" }}>
          {player.kickerEvents.map((event, index) => (
            <span key={`${event.text}-${index}`} style={{
              fontSize: "0.58rem", fontWeight: 700, borderRadius: 3, padding: "1px 4px",
              color: event.outcome === "made" ? "oklch(0.42 0.13 145)" : "oklch(0.5 0.18 25)",
              background: event.outcome === "made" ? "oklch(0.96 0.04 145)" : "oklch(0.97 0.04 25)",
              border: `1px solid ${event.outcome === "made" ? "oklch(0.85 0.06 145)" : "oklch(0.87 0.08 25)"}`,
            }}>
              {formatKickerEvent(event)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slot row (one row in the comparison grid) ─────────────────────────────────
function SlotRowComp({ row, injuries }: { row: SlotRow; injuries?: import("@/hooks/useNFLInjuries").InjuryMap }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "stretch",
      borderBottom: "1px solid oklch(0.92 0.005 150)",
      background: "white",
    }}>
      <PlayerCell player={row.home} side="home" injuries={injuries} />

      {/* Center position label */}
      <div style={{
        width: 32, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "oklch(0.96 0.01 150)",
        borderLeft: "1px solid oklch(0.9 0.005 150)",
        borderRight: "1px solid oklch(0.9 0.005 150)",
      }}>
        <span style={{
          fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
          fontSize: "0.6rem", letterSpacing: "0.06em",
          color: "oklch(0.45 0.06 150)",
          writingMode: "vertical-rl",
          textTransform: "uppercase",
          transform: "rotate(180deg)",
        }}>
          {row.slotLabel}
        </span>
      </div>

      <PlayerCell player={row.away} side="away" injuries={injuries} />
    </div>
  );
}

// ── Matchup detail view (the main expanded view) ──────────────────────────────
// ── Rivalry Game ─────────────────────────────────────────────────────────────
// Each owner may designate exactly one regular-season matchup per year as
// their rivalry game -- winner's money_owed goes down $30, loser's goes up
// $30 (funded from entry fees already collected, so this is purely a
// bookkeeping adjustment, not a new cash transaction). Locks immediately on
// selection, no changing later. Only shown when the currently-viewed
// matchup is the signed-in owner's own current-week game.
function RivalryGameControl({ matchup }: { matchup: Matchup }) {
  const { franchise } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const statusQuery = trpc.league.myRivalryGame.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const declareMutation = trpc.league.declareRivalryGame.useMutation();

  if (!franchise) return null;
  const myTeamName = franchise.team_name;
  const isMyMatchup = matchup.home.team === myTeamName || matchup.away.team === myTeamName;
  if (!isMyMatchup) return null;
  if (statusQuery.isLoading || !statusQuery.data) return null;

  const { declared, currentWeekEligible, currentWeekOpponentName } = statusQuery.data;

  const handleConfirm = async () => {
    try {
      const result = await declareMutation.mutateAsync();
      toast.success(`Rivalry game set vs ${result.opponentName}! Winner takes $30.`);
      await statusQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to declare rivalry game.");
    } finally {
      setConfirming(false);
    }
  };

  const boxStyle = { marginTop: "0.6rem", padding: "0.6rem 0.75rem", borderRadius: 8, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const };

  if (declared) {
    // Only show the "you're in a rivalry game" banner on the week it
    // was actually declared for, not on every subsequent week's matchup.
    if (declared.week !== matchup.week) return null;
    return (
      <div style={{ ...boxStyle, background: "oklch(0.95 0.06 25)", border: "1px solid oklch(0.7 0.15 25)" }}>
        <Swords size={16} color="oklch(0.45 0.18 25)" />
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "oklch(0.35 0.16 25)", fontFamily: "Barlow Condensed, sans-serif" }}>
          Rivalry Game vs {declared.opponentName} — winner takes $30
        </span>
      </div>
    );
  }

  // Everything below this point is about declaring for the CURRENT week
  // specifically -- if the owner is looking at a different week (via the
  // week dropdown), there's nothing to show here regardless of eligibility,
  // since the rule is "only your current week's game" and the already-
  // declared banner above already handles showing a past declaration.
  if (matchup.week !== statusQuery.data.currentWeek) return null;

  if (statusQuery.data.weekKickedOff) return null;

  if (!currentWeekEligible) return null; // already used this season's rivalry game, or not a valid regular-season week

  if (confirming) {
    return (
      <div style={{ ...boxStyle, background: "oklch(0.96 0.02 150)", border: "1px solid oklch(0.8 0.05 150)" }}>
        <span style={{ fontSize: "0.8rem", color: "oklch(0.35 0.05 150)" }}>
          Declare this as your rivalry game vs {currentWeekOpponentName}? Winner takes $30. This can't be undone.
        </span>
        <button
          onClick={handleConfirm}
          disabled={declareMutation.isPending}
          style={{ background: "oklch(0.42 0.15 150)", color: "white", border: "none", borderRadius: 6, padding: "0.35rem 0.8rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: declareMutation.isPending ? "not-allowed" : "pointer" }}
        >
          {declareMutation.isPending ? "Confirming…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={declareMutation.isPending}
          style={{ background: "white", color: "oklch(0.4 0.04 150)", border: "1px solid oklch(0.8 0.02 150)", borderRadius: 6, padding: "0.35rem 0.8rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <button
        onClick={() => setConfirming(true)}
        style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "oklch(0.95 0.06 25)", color: "oklch(0.4 0.16 25)", border: "1px solid oklch(0.7 0.15 25)", borderRadius: 6, padding: "0.4rem 0.85rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.02em", cursor: "pointer" }}
      >
        <Swords size={14} /> Make This Your Rivalry Game
      </button>
    </div>
  );
}

function MatchupDetail({ matchup, injuries }: { matchup: Matchup; injuries?: import("@/hooks/useNFLInjuries").InjuryMap }) {
  const homeWinning = matchup.home.score > matchup.away.score;
  // Win-probability bar is based on a blended estimate (projectedFinal):
  // actual points for any starter whose game has genuinely finished, their
  // pre-game projection otherwise. This starts identical to a pure
  // pre-game projection (a real matchup between two lineups essentially
  // never comes out exactly 50/50) and smoothly shifts toward the real
  // outcome as each starter's game actually completes over the course of
  // the week -- rather than swinging to an extreme split off a tiny,
  // still-incomplete sample the moment a single early game produces any
  // points at all, which raw current-score ratio did.
  const projectedFinalTotal = matchup.home.projectedFinal + matchup.away.projectedFinal;
  const homePct = projectedFinalTotal > 0
    ? (matchup.home.projectedFinal / projectedFinalTotal) * 100
    : 50;

  return (
    <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
      {/* Challenge banner */}
      {matchup.isChallenge && (
        <div style={{
          background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))",
          color: "oklch(0.15 0.02 150)",
          fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700,
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
            <TeamLogo teamName={matchup.home.team} size={44} style={{ borderRadius: 8, flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "2rem",
              color: homeWinning ? "#1a3a2a" : "oklch(0.55 0.04 150)", lineHeight: 1,
              }}>
                {matchup.home.score.toFixed(1)}
              </div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                color: "#1a6b3a", marginTop: 2,
              }}>
                {matchup.home.team}
              </div>
              <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                PROJ {matchup.home.projected.toFixed(1)}
              </div>
              {/* Players played */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: "0.65rem", color: "oklch(0.5 0.04 150)" }}>
                <span title="Played / Playing now / Yet to play">👥 {matchup.home.playersPlayed} {matchup.home.playersPlaying} {matchup.home.playersYetToPlay}</span>
                <span title="Total minutes remaining across all your starters' games (10 starters x 60 min = 600 to start)">⏱ {matchup.home.minutesRemaining}</span>
              </div>
            </div>
          </div>

          {/* Away side */}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: "0.5rem", flexDirection: "row-reverse" }}>
            <TeamLogo teamName={matchup.away.team} size={44} style={{ borderRadius: 8, flexShrink: 0 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "2rem",
              color: !homeWinning ? "#1a3a2a" : "oklch(0.55 0.04 150)", lineHeight: 1,
              }}>
                {matchup.away.score.toFixed(1)}
              </div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                color: "#1a6b3a", marginTop: 2,
              }}>
                {matchup.away.team}
              </div>
              <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>
                PROJ {matchup.away.projected.toFixed(1)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", justifyContent: "flex-end" }}>
                <span title="Played / Playing now / Yet to play">👥 {matchup.away.playersPlayed} {matchup.away.playersPlaying} {matchup.away.playersYetToPlay}</span>
                <span title="Total minutes remaining across all your starters' games (10 starters x 60 min = 600 to start)">⏱ {matchup.away.minutesRemaining}</span>
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
          <span style={{ fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif" }}>
            {homePct.toFixed(0)}%
          </span>
          <span style={{ fontSize: "0.65rem", color: "oklch(0.5 0.04 150)", flexShrink: 0, fontFamily: "Barlow Condensed, sans-serif" }}>
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

        <RivalryGameControl matchup={matchup} />

        {/* OFFENSE label */}
        <div style={{
          textAlign: "center", marginTop: "0.5rem", marginBottom: 0,
          fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
          fontSize: "0.72rem", letterSpacing: "0.12em",
          color: "oklch(0.45 0.04 150)", textTransform: "uppercase",
          borderTop: "1px solid oklch(0.9 0.005 150)",
          paddingTop: "0.4rem",
        }}>
          OFFENSE
        </div>
      </div>

      {/* Slot-by-slot comparison */}
      {matchup.home.owner === "TBD" ? (
        <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "oklch(0.5 0.04 150)" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Playoff matchup not yet determined
          </div>
          <div style={{ fontSize: "0.85rem" }}>Check back once the regular season ends and standings are final.</div>
        </div>
      ) : (
        <div>
          {matchup.slots.map((row, i) => (
            <SlotRowComp key={i} row={row} injuries={injuries} />
          ))}
        </div>
      )}

      {/* BENCH section */}
      {(matchup.bench.home.length > 0 || matchup.bench.away.length > 0) && (
        <>
          {/* Bench divider label */}
          <div style={{
            textAlign: "center",
            fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
            fontSize: "0.72rem", letterSpacing: "0.12em",
            color: "oklch(0.55 0.04 150)", textTransform: "uppercase",
            background: "oklch(0.96 0.008 150)",
            borderTop: "2px solid oklch(0.88 0.01 150)",
            borderBottom: "1px solid oklch(0.9 0.005 150)",
            padding: "0.35rem 0",
          }}>
            BENCH
          </div>
          {/* Bench rows — pair home[i] with away[i] side by side */}
          {Array.from({ length: Math.max(matchup.bench.home.length, matchup.bench.away.length) }).map((_, i) => {
            const hp = matchup.bench.home[i] ?? null;
            const ap = matchup.bench.away[i] ?? null;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "stretch",
                borderBottom: "1px solid oklch(0.93 0.004 150)",
                background: "oklch(0.975 0.003 150)",
                opacity: 0.88,
              }}>
                <PlayerCell player={hp} side="home" injuries={injuries} />
                {/* Center BN label */}
                <div style={{
                  width: 32, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "oklch(0.93 0.005 150)",
                  borderLeft: "1px solid oklch(0.9 0.005 150)",
                  borderRight: "1px solid oklch(0.9 0.005 150)",
                }}>
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
                    fontSize: "0.58rem", letterSpacing: "0.06em",
                    color: "oklch(0.6 0.04 150)",
                    writingMode: "vertical-rl",
                    textTransform: "uppercase",
                    transform: "rotate(180deg)",
                  }}>BN</span>
                </div>
                <PlayerCell player={ap} side="away" injuries={injuries} />
              </div>
            );
          })}
        </>
      )}
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
      <TeamLogo teamName={matchup.home.team} size={22} style={{ borderRadius: 4, flexShrink: 0 }} />
      <span style={{
        fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem",
        color: active ? "#1a3a2a" : "white",
      }}>
        {matchup.home.score.toFixed(1)}
      </span>
      <span style={{ fontSize: "0.7rem", color: active ? "oklch(0.5 0.04 150)" : "rgba(255,255,255,0.6)" }}>vs</span>
      <span style={{
        fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem",
        color: active ? "#1a3a2a" : "white",
      }}>
        {matchup.away.score.toFixed(1)}
      </span>
      <TeamLogo teamName={matchup.away.team} size={22} style={{ borderRadius: 4, flexShrink: 0 }} />
      {matchup.isChallenge && (
        <span style={{ fontSize: "0.65rem" }}>⚔️</span>
      )}
    </button>
  );
}

// ── Owner → Supabase team_id ──────────────────────────────────────────────────
const OWNER_TO_TEAM_ID: Record<string, string> = {
  "Jonas":    "team-jonas",
  "David R.": "team-davidr",
  "Jason":    "team-jason",
  "Jamie":    "team-jamie",
  "Keith":    "team-keith",
  "Dan":      "team-dan",
  "Scott N.": "team-scottn",
  "Bill":     "team-bill",
  "Scott M.": "team-scottm",
  "David S.": "team-davids",
  "Shawn":    "team-shawn",
  "Greg":     "team-greg",
};

// ── Slot ordering for default lineup ─────────────────────────────────────────
const SLOT_ORDER = ["QB", "RB", "RB", "WR", "WR", "TE", "SFLEX", "FLEX", "K", "DST"] as const;
type SlotLabel = typeof SLOT_ORDER[number];

function abbrevName(full: string): string {
  const parts = full.trim().split(" ");
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

type DbPlayer = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
  team_id: string;
  is_starter: boolean;
};

type LineupRow = {
  slot: string;
  player_name: string;
  is_bench: boolean;
};

/**
 * Build a SlotPlayer from player metadata + live/projected points.
 */
function makeSlotPlayer(
  player: DbPlayer,
  pts: number,
  proj: number,
  matchupMap: import("@/hooks/useNFLMatchups").NFLMatchupMap,
  gameStatus: NFLGameStatusMap,
  liveStats: import("@/hooks/useNFLLiveScores").LiveStatsMap,
  kickerEvents: KickerPlayEvent[] = [],
): SlotPlayer {
  const matchup = matchupMap[player.nfl_team?.toUpperCase()] ?? null;
  const status = gameStatus[normalizeNFLTeam(player.nfl_team ?? "")];
  const opponentInfo = matchup ? `${matchup.isHome ? "vs" : "@"} ${matchup.opponent}` : "";
  let gameInfo = "";
  if (matchup) {
    if (status?.state === "in") {
      // Live: show the current quarter and clock instead of the
      // scheduled kickoff time, since that's no longer the useful piece
      // of information once the game is actually underway.
      const quarterLabel = status.period >= 5 ? "OT" : `Q${status.period}`;
      gameInfo = `${opponentInfo} ${quarterLabel} ${status.displayClock}`;
    } else if (status?.state === "post") {
      gameInfo = `${opponentInfo} Final`;
    } else {
      gameInfo = `${opponentInfo} ${formatGameTime(matchup).replace(" ET", "")}`;
    }
  }
  const rawStats = getLiveStats(liveStats, player.name, player.position, player.nfl_team ?? "");
  const stats = rawStats ? buildStatChips(rawStats) : [];
  return {
    name: abbrevName(player.name),
    fullName: player.name,
    pos: player.position,
    nflTeam: player.nfl_team,
    pts,
    proj,
    gameInfo,
    stats,
    kickerEvents: player.position === "K" ? getKickerEventsForPlayer(kickerEvents, player.name) : undefined,
    isTE: player.position === "TE",
    status: "active",
  };
}

/**
 * Build Matchup objects from schedule + lineups + players + live scores.
 */
async function buildMatchupsFromLineups(
  week: number,
  liveScores: import("@/hooks/useNFLLiveScores").LiveScoreMap,
  liveStats: import("@/hooks/useNFLLiveScores").LiveStatsMap,
  kickerEvents: KickerPlayEvent[],
  projections: import("@/hooks/useNFLProjections").ProjectionMap,
  matchupMap: import("@/hooks/useNFLMatchups").NFLMatchupMap,
  nflTeamPool: readonly { name: string; adp: number }[],
  gameStatus: NFLGameStatusMap,
): Promise<Matchup[]> {
  const scheduleWeek = SCHEDULE_2026.find(w => w.week === week);
  if (!scheduleWeek) return [];

  // Load all players from Supabase (metadata)
  const { data: allPlayers } = await supabase
    .from("players")
    .select("id,name,position,nfl_team,team_id,is_starter");
  const playersByTeam: Record<string, DbPlayer[]> = {};
  for (const p of (allPlayers ?? []) as DbPlayer[]) {
    if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = [];
    playersByTeam[p.team_id].push(p);
  }

  // Load saved lineups for this week
  const { data: lineupRows } = await supabase
    .from("lineups")
    .select("team_id,slot,player_name,is_bench")
    .eq("week", week)
    .eq("season", 2026);
  const lineupsByTeam: Record<string, LineupRow[]> = {};
  for (const row of (lineupRows ?? []) as (LineupRow & { team_id: string })[]) {
    if (!lineupsByTeam[row.team_id]) lineupsByTeam[row.team_id] = [];
    lineupsByTeam[row.team_id].push(row);
  }

  const matchups: Matchup[] = [];

  for (let idx = 0; idx < scheduleWeek.matchups.length; idx++) {
    const [homeOwner, awayOwner] = scheduleWeek.matchups[idx];

    // Playoff weeks (Wild Card/Divisional/Super Bowl) start with "TBD"
    // placeholders in SCHEDULE_2026 until the regular season ends and
    // standings determine who actually qualifies. "TBD" isn't a real
    // owner name, so OWNER_TO_TEAM_ID[homeOwner] would resolve to
    // undefined -- the various "?? []" fallbacks below would keep that
    // from crashing, but would silently produce an empty, broken-looking
    // roster table rather than a clear "matchup not yet set" state. Skip
    // straight to a minimal placeholder instead.
    if (homeOwner === "TBD" || awayOwner === "TBD") {
      const tbdSide: TeamSide = {
        team: "TBD", owner: "TBD", score: 0, projected: 0, projectedFinal: 0,
        playersPlayed: 0, playersPlaying: 0, playersYetToPlay: 0,
        minutesRemaining: 0, playersTotal: 0,
      };
      matchups.push({
        id: idx, week, isChallenge: false,
        home: tbdSide, away: tbdSide,
        slots: [], bench: { home: [], away: [] },
      });
      continue;
    }

    const homeTeamId = OWNER_TO_TEAM_ID[homeOwner];
    const awayTeamId = OWNER_TO_TEAM_ID[awayOwner];

    const buildSide = (teamId: string, owner: string): { side: TeamSide; slots: SlotRow[]; bench: BenchPlayer[] } => {
      const teamPlayers = playersByTeam[teamId] ?? [];
      const savedLineup = lineupsByTeam[teamId] ?? [];
      const playerByName: Record<string, DbPlayer> = {};
      for (const p of teamPlayers) playerByName[normalizePlayerName(p.name)] = p;

      let starters: Array<{ slot: string; player: DbPlayer }> = [];
      let benchPlayers: DbPlayer[] = [];

      if (savedLineup.length > 0) {
        // Use saved lineup
        for (const row of savedLineup) {
          const p = playerByName[normalizePlayerName(row.player_name)];
          if (!p) continue;
          if (row.is_bench) benchPlayers.push(p);
          else {
            // Normalize RB1/RB2 → RB, WR1/WR2 → WR, TE1/TE2 → TE
            const normalizedSlot = row.slot.replace(/^(RB|WR|TE)\d+$/, "$1");
            starters.push({ slot: normalizedSlot, player: p });
          }
        }
      } else {
        // Default: no saved lineup exists for this team/week yet. Previously
        // this picked whichever player at each position happened to be
        // first in teamPlayers -- an unordered array from the players
        // table with no inherent meaning. Since protected players are
        // written to that table earlier (pre-draft, during protection
        // locking) than drafted players (added later during the live
        // draft), they'd cluster earlier in that array purely by accident
        // of insertion timing, making this fallback systematically prefer
        // protected players over drafted ones regardless of who was
        // actually better -- not a real selection, just array-order luck.
        // Sorting by ADP first means the best available player at each
        // position gets picked, matching what a sensible default lineup
        // should actually look like. Extracted to buildDefaultStarters so
        // this same logic can also be reused by useOwnerMatchupScore
        // (Standings page's live matchup score) without risking drift
        // between two separately-maintained copies.
        starters = buildDefaultStarters(teamPlayers, nflTeamPool);
        const used = new Set(starters.map(s => s.player.id));
        benchPlayers = teamPlayers.filter(p => !used.has(p.id));
      }

      // Build slot rows
      const slotRows: SlotRow[] = SLOT_ORDER.map((slotLabel) => {
        const match = starters.find(s => s.slot === slotLabel && !starters.some((s2, i2) => s2.slot === slotLabel && starters.indexOf(s) > i2 && starters.indexOf(s2) < starters.indexOf(s)));
        const player = match?.player ?? null;
        const pts = player ? (getLivePoints(liveScores, player.name, player.position, player.nfl_team, kickerEvents, liveStats) ?? 0) : 0;
        const proj = player ? getProjectedPoints(projections, player.name, player.position, player.nfl_team) : 0;
        return {
          slotLabel,
          home: null,
          away: null,
          _player: player ? makeSlotPlayer(player, pts, proj, matchupMap, gameStatus, liveStats, kickerEvents) : null,
        } as SlotRow & { _player: SlotPlayer | null };
      });

      // Pair starters into slots (handle duplicate slot labels like RB, WR)
      const slotCounts: Record<string, number> = {};
      const pairedSlots: SlotRow[] = SLOT_ORDER.map((slotLabel) => {
        const count = slotCounts[slotLabel] ?? 0;
        slotCounts[slotLabel] = count + 1;
        const matches = starters.filter(s => s.slot === slotLabel);
        const player = matches[count]?.player ?? null;
        const pts = player ? (getLivePoints(liveScores, player.name, player.position, player.nfl_team, kickerEvents, liveStats) ?? 0) : 0;
        const proj = player ? getProjectedPoints(projections, player.name, player.position, player.nfl_team) : 0;
        return {
          slotLabel,
          home: null,
          away: null,
          _player: player ? makeSlotPlayer(player, pts, proj, matchupMap, gameStatus, liveStats, kickerEvents) : null,
        } as SlotRow & { _player: SlotPlayer | null };
      });

      void slotRows;

      const totalPts = pairedSlots.reduce((sum, s) => sum + ((s as SlotRow & { _player: SlotPlayer | null })._player?.pts ?? 0), 0);
      const totalProj = pairedSlots.reduce((sum, s) => sum + ((s as SlotRow & { _player: SlotPlayer | null })._player?.proj ?? 0), 0);
      // Blended win-probability estimate: actual points for any starter
      // whose game has genuinely finished (fully known), their pre-game
      // projection otherwise (still in progress or not yet started).
      // Starts identical to totalProj before any game finishes, then
      // smoothly shifts toward the real total as each starter's game
      // actually completes -- unlike using totalPts directly, which
      // swings to an extreme 0/100 split off a tiny, still-incomplete
      // sample the moment a single early game produces any points at all.
      const totalProjectedFinal = pairedSlots.reduce((sum, s) => {
        const player = (s as SlotRow & { _player: SlotPlayer | null })._player;
        if (!player) return sum;
        const state = gameStatus[normalizeNFLTeam(player.nflTeam)]?.state;
        return sum + (state === "post" ? player.pts : player.proj);
      }, 0);

      // Status-based three-way split (rather than mixing in the points>0
      // check used elsewhere) so these three numbers always sum cleanly to
      // playersTotal: a player can have 0 points with a finished game
      // (e.g. inactive), which points-based counting alone can't place
      // consistently into any of the three buckets.
      const starterGameStates = pairedSlots.map(s => {
        const player = (s as SlotRow & { _player: SlotPlayer | null })._player;
        if (!player) return null;
        return gameStatus[normalizeNFLTeam(player.nflTeam)] ?? null;
      });
      const playersPlayed = starterGameStates.filter(g => g?.state === "post").length;
      const playersPlaying = starterGameStates.filter(g => g?.state === "in").length;
      const playersYetToPlay = pairedSlots.length - playersPlayed - playersPlaying;

      // Total minutes remaining in regulation across every starter's game,
      // summed together -- 10 starters at 60 minutes each starts at 600
      // and counts down as each individual game progresses toward final.
      // An empty slot (no player assigned) still counts as a full 60,
      // same as a game that hasn't kicked off yet, since the 600 baseline
      // is meant to reflect the fixed 10-starter lineup regardless of
      // whether every slot happens to be filled at this exact moment.
      const minutesRemaining = Math.round(
        pairedSlots.reduce((sum, s) => {
          const player = (s as SlotRow & { _player: SlotPlayer | null })._player;
          if (!player) return sum + 60;
          return sum + minutesRemainingInGame(gameStatus[normalizeNFLTeam(player.nflTeam)]);
        }, 0),
      );

      const side: TeamSide = {
        team: OWNER_TO_TEAM[owner] ?? owner,
        owner,
        score: Math.round(totalPts * 100) / 100,
        projected: Math.round(totalProj * 100) / 100,
        projectedFinal: Math.round(totalProjectedFinal * 100) / 100,
        playersPlayed,
        playersPlaying,
        playersYetToPlay,
        minutesRemaining,
        playersTotal: pairedSlots.length,
      };

      const bench: BenchPlayer[] = benchPlayers.slice(0, 8).map(p => {
        const pts = getLivePoints(liveScores, p.name, p.position, p.nfl_team, kickerEvents, liveStats) ?? 0;
        const proj = getProjectedPoints(projections, p.name, p.position, p.nfl_team);
        return { ...makeSlotPlayer(p, pts, proj, matchupMap, gameStatus, liveStats, kickerEvents), slot: "BN" as const };
      });

      return { side, slots: pairedSlots as SlotRow[], bench };
    };

    const home = buildSide(homeTeamId, homeOwner);
    const away = buildSide(awayTeamId, awayOwner);

    // Merge home/away into paired slot rows
    const mergedSlots: SlotRow[] = SLOT_ORDER.map((slotLabel, i) => ({
      slotLabel,
      home: (home.slots[i] as SlotRow & { _player: SlotPlayer | null })._player,
      away: (away.slots[i] as SlotRow & { _player: SlotPlayer | null })._player,
    }));

    matchups.push({
      id: idx + 1,
      week,
      isChallenge: false,
      home: home.side,
      away: away.side,
      slots: mergedSlots,
      bench: { home: home.bench, away: away.bench },
    });
  }

  return matchups;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveScoring() {
  const { franchise } = useAuth();
  const draftPlayerPool = useDraftPlayerUniverse();
  const [, navigate] = useLocation();
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [liveMatchups, setLiveMatchups] = useState<Matchup[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const autoSelectedWeekRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);

  // The true current week, independent of whatever week is actually being
  // viewed (which may be overridden via ?week=N) -- used only to label
  // that one option in the dropdown so a person browsing an old week can
  // still tell where "now" is.
  const actualCurrentWeek = useMemo(() => {
    const w = getCurrentWeek();
    return w > 0 ? w : 1;
  }, []);

  // Read ?week=N from the URL; fall back to the current real week
  function getWeekFromUrl(): number {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const weekParam = params.get("week");
    if (weekParam) {
      const parsed = parseInt(weekParam, 10);
      if (!isNaN(parsed) && SCHEDULE_2026.some(w => w.week === parsed)) return parsed;
    }
    const w = getCurrentWeek();
    return w > 0 ? w : 1;
  }
  // Real state rather than a useMemo derived from `location`: wouter's
  // useLocation() tracks pathname only, not query string, so navigating
  // from /live?week=1 to /live?week=5 doesn't reliably register as a
  // location change -- the useMemo would never re-run even though the
  // URL bar itself updates, which is exactly why the dropdown wasn't
  // actually changing anything. The dropdown's onChange now calls
  // setCurrentWeek directly; navigate() is still called alongside it
  // purely to keep the URL in sync for bookmarking/sharing, not to drive
  // the update itself.
  const [currentWeek, setCurrentWeek] = useState<number>(getWeekFromUrl);

  // Live NFL matchup map (for game info + polling)
  const { matchups: nflMatchupMap } = useNFLMatchups(currentWeek);
  // Live per-team game status (pre/in/post), for the playing-now/yet-to-play/time-left display
  const { gameStatus: nflGameStatus } = useNFLGameStatus(nflMatchupMap);
  // Live scores (polls during active games)
  const { liveScores, liveStats, isPolling, kickerEvents } = useNFLLiveScores(currentWeek, 2026, nflMatchupMap);
  // Projected points
  const { projections } = useNFLProjections(currentWeek);

  // Injury designations
  const { injuries } = useNFLInjuries();

  const loadMatchups = useCallback(async () => {
    // Only show the "Loading matchups..." state on the very first load.
    // liveScores and nflGameStatus both update every ~30s from background
    // polling, which recreates this callback and re-runs the effect below
    // each time -- without this check, setLoading(true) would fire on
    // every single poll, blanking out the entire matchup card and pill
    // selector and immediately replacing them with a loading message
    // every 30 seconds, which is exactly the flashing being reported.
    // Subsequent refreshes should update in place with no visible
    // interruption, same as any other stale-while-revalidate pattern.
    // Uses a ref rather than liveMatchups.length in the dependency array
    // below, since that state is itself updated inside this callback --
    // referencing it directly would recreate the callback (and trigger
    // one extra fetch) the moment the initial load completes.
    const isInitialLoad = !hasLoadedOnceRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const matchups = await buildMatchupsFromLineups(currentWeek, liveScores, liveStats, kickerEvents, projections, nflMatchupMap, draftPlayerPool, nflGameStatus);
      if (matchups.length > 0) {
        setLiveMatchups(matchups);
      } else if (isInitialLoad) {
        setLiveMatchups(MOCK_MATCHUPS.slice(0, 6));
      }
    } catch {
      if (isInitialLoad) setLiveMatchups(MOCK_MATCHUPS.slice(0, 6));
    }
    setLastRefresh(new Date());
    hasLoadedOnceRef.current = true;
    if (isInitialLoad) setLoading(false);
  }, [currentWeek, liveScores, liveStats, kickerEvents, projections, nflMatchupMap, draftPlayerPool, nflGameStatus]);

  // Reload matchups whenever live scores or projections update
  useEffect(() => {
    loadMatchups();
  }, [loadMatchups]);

  // Auto-select the franchise's matchup on initial load or when the week
  // actually changes -- NOT on every background poll refresh. liveMatchups
  // gets a brand-new array reference every ~30s from polling even when the
  // underlying data is identical, so depending on it directly here would
  // re-run this every single poll cycle, unconditionally resetting activeId
  // back to the owner's own matchup regardless of what they'd manually
  // selected to view instead.
  useEffect(() => {
    if (!franchise || liveMatchups.length === 0) return;
    if (autoSelectedWeekRef.current === currentWeek) return;
    const myTeam = franchise.team_name;
    const myMatchup = liveMatchups.find(
      m => m.home.team === myTeam || m.away.team === myTeam
    );
    if (myMatchup) {
      setActiveId(myMatchup.id);
      autoSelectedWeekRef.current = currentWeek;
    }
  }, [liveMatchups, franchise, currentWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    loadMatchups();
    setCountdown(REFRESH_SECONDS);
  }, [loadMatchups]);

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

  const displayMatchups = liveMatchups.length > 0 ? liveMatchups : MOCK_MATCHUPS;
  const effectiveActiveId = activeId ?? (displayMatchups[0]?.id ?? 1);
  const activeMatchup = displayMatchups.find(m => m.id === effectiveActiveId) ?? displayMatchups[0];

  // Compute league median for ticker
  const allScores = displayMatchups.flatMap(m => [
    m.home.score > 0 ? m.home.score : null,
    m.away.score > 0 ? m.away.score : null,
  ]).filter((s): s is number => s !== null);
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const mid = Math.floor(sortedScores.length / 2);
  const median = sortedScores.length > 0
    ? (sortedScores.length % 2 === 0 ? (sortedScores[mid - 1] + sortedScores[mid]) / 2 : sortedScores[mid])
    : 0;
  const aboveMedian = allScores.filter(s => s > median).length;

  // Whether every team playing this week has a final game -- distinct from
  // isPolling (which only tracks whether something is live right now), so
  // a fully completed past week shows as final rather than incorrectly
  // still saying "Pre-Game Projections."
  const weekTeams = Object.keys(nflMatchupMap);
  const weekIsComplete = weekTeams.length > 0 && weekTeams.every(team => nflGameStatus[team]?.state === "post");

  const tickerMessages = [
    isPolling
      ? `🔴 LIVE — Week ${currentWeek} Scoring in Progress`
      : weekIsComplete
        ? `✅ Week ${currentWeek} — Final`
        : `📅 Week ${currentWeek} — Pre-Game Projections`,
    `📊 LEAGUE MEDIAN: ${median.toFixed(1)} pts — ${aboveMedian} teams above`,
    isPolling ? "⚡ Live scores updating every 30 seconds from Tank01" : "📋 Lineups loaded from Supabase · Save your lineup to lock in starters",
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
        {/* Week selector -- defaults to the current real week, but any
            week can be picked to view its history. Once every one of that
            week's NFL games is final, its live-scoring numbers are final
            too and just sit there as a permanent record, same as any
            other past week -- there's no separate "archived" state to
            build, since a finished game's status naturally stops
            changing on its own. */}
        <select
          value={currentWeek}
          onChange={e => {
            const week = Number(e.target.value);
            setCurrentWeek(week);
            navigate(`/live?week=${week}`);
          }}
          style={{
            fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.72rem",
            letterSpacing: "0.08em", color: "oklch(0.78 0.15 85)",
            background: "oklch(0.78 0.15 85 / 0.15)", border: "1px solid oklch(0.78 0.15 85 / 0.3)",
            borderRadius: 5, padding: "2px 22px 2px 8px", flexShrink: 0, whiteSpace: "nowrap",
            cursor: "pointer", appearance: "none",
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ceb15a' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center",
          }}
        >
          {SCHEDULE_2026.map(({ week, label }) => (
            <option key={week} value={week} style={{ background: "#1a2318", color: "white" }}>
              {label}{week === actualCurrentWeek ? " (Current)" : ""}
            </option>
          ))}
        </select>
        {loading ? (
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Barlow Condensed, sans-serif" }}>Loading matchups…</span>
        ) : (
          displayMatchups.map(m => (
            <MatchupPill key={m.id} matchup={m} active={m.id === effectiveActiveId} onClick={() => setActiveId(m.id)} />
          ))
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.35rem",
            background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.3rem 0.6rem",
          }}>
            <Clock size={12} color="rgba(255,255,255,0.7)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", letterSpacing: "0.04em" }}>{timeStr}</span>
          </div>
          <button onClick={refresh} style={{
            background: "oklch(0.28 0.09 150)", border: "none", borderRadius: 8,
            padding: "0.3rem 0.6rem", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.3rem",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem",
          }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Page title */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 1rem 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <h1 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: "white", letterSpacing: "0.04em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              LIVE SCORING
              {isPolling && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,60,60,0.2)", border: "1px solid rgba(255,60,60,0.4)", borderRadius: 6, padding: "0.1rem 0.5rem", fontSize: "0.65rem", color: "#ff8080", letterSpacing: "0.08em" }}>
                  <Wifi size={10} />
                  LIVE
                </span>
              )}
            </h1>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
              Week {currentWeek} · Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Active matchup detail */}
        {loading ? (
          <div style={{ background: "white", borderRadius: 12, padding: "2rem", textAlign: "center" as const, color: "oklch(0.5 0.04 150)" }}>
            Loading matchups…
          </div>
        ) : activeMatchup ? (
          <MatchupDetail matchup={activeMatchup} injuries={injuries} />
        ) : null}

        {/* League Scoreboard — all 12 teams sorted by score with median line */}
        {!loading && displayMatchups.length > 0 && (
          <div className="wrc-card" style={{ marginTop: "1.25rem", overflow: "hidden" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>League Scoreboard</span>
              <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.16 85)", fontWeight: 700 }}>
                Median: {median.toFixed(1)} pts
              </span>
            </div>
            <div>
              {(() => {
                // Build sorted list of all teams with their scores
                const gamesStarted = displayMatchups.some(m => m.home.score > 0 || m.away.score > 0);
                const allTeams = displayMatchups.flatMap(m => [
                  { team: m.home.team, score: m.home.score, proj: m.home.projected },
                  { team: m.away.team, score: m.away.score, proj: m.away.projected },
                ]).sort((a, b) => gamesStarted ? b.score - a.score : b.proj - a.proj);

                // Compute median based on same sort key
                const sortKey = (t: { score: number; proj: number }) => gamesStarted ? t.score : t.proj;
                const sortedVals = [...allTeams].map(sortKey).sort((a, b) => a - b);
                const midIdx = Math.floor(sortedVals.length / 2);
                const displayMedian = sortedVals.length > 0
                  ? (sortedVals.length % 2 === 0 ? (sortedVals[midIdx - 1] + sortedVals[midIdx]) / 2 : sortedVals[midIdx])
                  : 0;

                let medianInserted = false;
                return allTeams.map((t, i) => {
                  const val = sortKey(t);
                  const nextVal = i < allTeams.length - 1 ? sortKey(allTeams[i + 1]) : -1;
                  const isAbove = val >= displayMedian && displayMedian > 0;
                  const nextBelow = !medianInserted && i < allTeams.length - 1 && nextVal < displayMedian && val >= displayMedian && displayMedian > 0;
                  const showMedianLine = !medianInserted && nextBelow;
                  if (showMedianLine) medianInserted = true;

                  return (
                    <div key={t.team}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "0.6rem",
                        padding: "0.45rem 1rem",
                        borderBottom: "1px solid oklch(0.95 0.003 150)",
                        background: isAbove ? "oklch(0.97 0.02 150)" : "white",
                      }}>
                        {/* Rank */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.7rem", color: "oklch(0.6 0.04 150)", width: 16, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                        {/* Above/below indicator */}
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: displayMedian > 0 ? (isAbove ? "oklch(0.55 0.18 150)" : "oklch(0.55 0.18 25)") : "oklch(0.8 0.01 150)", flexShrink: 0, display: "inline-block" }} />
                        {/* Team name */}
                        <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "oklch(0.22 0.06 150)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.team}</span>
                        {/* Score */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)", flexShrink: 0 }}>
                          {gamesStarted ? t.score.toFixed(1) : <span style={{ color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>—</span>}
                        </span>
                        {/* Proj */}
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: gamesStarted ? "0.68rem" : "0.88rem", fontWeight: gamesStarted ? 400 : 700, color: gamesStarted ? "oklch(0.55 0.04 150)" : "oklch(0.22 0.08 150)", flexShrink: 0, minWidth: 52, textAlign: "right" }}>
                          {gamesStarted ? `Proj ${t.proj.toFixed(1)}` : t.proj.toFixed(1)}
                        </span>
                      </div>
                      {showMedianLine && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 1rem", background: "oklch(0.97 0.04 85 / 0.35)", borderTop: "1.5px dashed oklch(0.78 0.15 85)", borderBottom: "1.5px dashed oklch(0.78 0.15 85)" }}>
                          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.12 85)", textTransform: "uppercase" }}>── MEDIAN LINE · {displayMedian.toFixed(1)} pts ──</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", textAlign: "center" as const, marginTop: "1rem", paddingBottom: "2rem" }}>
          Tap a matchup above to switch · Auto-refreshes every 5 minutes
        </p>
      </div>
    </div>
  );
}
