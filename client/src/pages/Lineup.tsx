/**
 * WRC Fantasy Football - Lineup Page
 * Layout: Starters on top (full width), Bench below (full width)
 * Features: Best Lineup optimizer, per-player game info (day/time/opp/location), inline swap panel
 * TE Premium: 1.5x PPR for TE position regardless of slot
 */
import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, CheckCircle2, ChevronDown, ArrowLeftRight, X, Zap } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";
import { useDraftedRoster } from "@/hooks/useDraftedRoster";

const STARTER_SLOTS = [
  { slot: "QB",    label: "Quarterback",   eligible: ["QB"] },
  { slot: "RB1",   label: "Running Back",  eligible: ["RB"] },
  { slot: "RB2",   label: "Running Back",  eligible: ["RB"] },
  { slot: "WR1",   label: "Wide Receiver", eligible: ["WR"] },
  { slot: "WR2",   label: "Wide Receiver", eligible: ["WR"] },
  { slot: "TE",    label: "Tight End",     eligible: ["TE"] },
  { slot: "SFLEX", label: "Super Flex",    eligible: ["QB","RB","WR","TE"] },
  { slot: "FLEX",  label: "Flex",          eligible: ["RB","WR","TE"] },
  { slot: "K",     label: "Kicker",        eligible: ["K"] },
  { slot: "DST",   label: "Defense / ST",  eligible: ["DST"] },
];

// NFL game schedule data keyed by team abbreviation
// Format: { day, time (ET), opp, home: true = playing at home }
const NFL_GAMES: Record<string, { day: string; time: string; opp: string; home: boolean }> = {
  BUF: { day: "Sun", time: "1:00pm", opp: "NYJ", home: true },
  BAL: { day: "Sun", time: "1:00pm", opp: "CLE", home: false },
  PHI: { day: "Sun", time: "4:25pm", opp: "NYG", home: true },
  MIA: { day: "Sun", time: "1:00pm", opp: "NE",  home: false },
  DAL: { day: "Sun", time: "4:25pm", opp: "WSH", home: true },
  DET: { day: "Sun", time: "1:00pm", opp: "CHI", home: true },
  KC:  { day: "Sun", time: "4:25pm", opp: "LV",  home: true },
  SF:  { day: "Sun", time: "4:25pm", opp: "LAR", home: false },
  TEN: { day: "Sun", time: "1:00pm", opp: "IND", home: true },
  ATL: { day: "Sun", time: "1:00pm", opp: "CAR", home: true },
  LAC: { day: "Sun", time: "4:25pm", opp: "DEN", home: false },
  CLE: { day: "Sun", time: "1:00pm", opp: "BAL", home: true },
  CIN: { day: "Mon", time: "8:15pm", opp: "PIT", home: true },
  PIT: { day: "Mon", time: "8:15pm", opp: "CIN", home: false },
  GB:  { day: "Thu", time: "8:20pm", opp: "MIN", home: true },
  MIN: { day: "Thu", time: "8:20pm", opp: "GB",  home: false },
};

const DAY_COLORS: Record<string, string> = {
  Thu: "oklch(0.55 0.18 260)",
  Sun: "oklch(0.38 0.15 150)",
  Mon: "oklch(0.55 0.18 25)",
  Sat: "oklch(0.55 0.16 85)",
};

interface SeasonStats {
  // Common
  gp: number;          // games played
  // Passing
  passYds?: number;
  passTd?: number;
  passInt?: number;
  // Rushing
  rushYds?: number;
  rushTd?: number;
  rushAtt?: number;
  // Receiving
  rec?: number;
  recYds?: number;
  recTd?: number;
  // Kicker
  fgm?: number;
  fga?: number;
  xpm?: number;
  // DST
  sacks?: number;
  defInt?: number;
  defTd?: number;
  pa?: number;         // points allowed avg
}

interface Player {
  id: string;
  name: string;
  nflTeam: string;
  pos: string;
  pts: number;
  proj: number;
  status: string;
  slot?: string;
  isBench?: boolean;
  // Season stats
  seasonFpts?: number;   // total season fantasy points
  byeWeek?: number;      // NFL bye week number
  seasonStats?: SeasonStats;
}

const MOCK_STARTERS: Player[] = [
  { id: "s1",  slot: "QB",    name: "Josh Allen",           nflTeam: "BUF", pos: "QB",  pts: 34.2, proj: 38.0, status: "Active", byeWeek: 12, seasonFpts: 412.8, seasonStats: { gp: 13, passYds: 3842, passTd: 32, passInt: 6, rushYds: 524, rushTd: 7 } },
  { id: "s2",  slot: "RB1",   name: "Derrick Henry",        nflTeam: "BAL", pos: "RB",  pts: 18.6, proj: 22.0, status: "Active", byeWeek: 14, seasonFpts: 298.4, seasonStats: { gp: 13, rushYds: 1512, rushTd: 14, rushAtt: 248, rec: 18, recYds: 112 } },
  { id: "s3",  slot: "RB2",   name: "Saquon Barkley",       nflTeam: "PHI", pos: "RB",  pts: 22.4, proj: 24.5, status: "Active", byeWeek: 5,  seasonFpts: 276.2, seasonStats: { gp: 13, rushYds: 1284, rushTd: 11, rushAtt: 218, rec: 34, recYds: 248, recTd: 2 } },
  { id: "s4",  slot: "WR1",   name: "Tyreek Hill",          nflTeam: "MIA", pos: "WR",  pts: 14.8, proj: 18.0, status: "Active", byeWeek: 6,  seasonFpts: 218.6, seasonStats: { gp: 13, rec: 72, recYds: 1024, recTd: 6 } },
  { id: "s5",  slot: "WR2",   name: "CeeDee Lamb",          nflTeam: "DAL", pos: "WR",  pts: 28.6, proj: 26.0, status: "Active", byeWeek: 7,  seasonFpts: 312.4, seasonStats: { gp: 13, rec: 94, recYds: 1348, recTd: 11 } },
  { id: "s6",  slot: "TE",    name: "Sam LaPorta",          nflTeam: "DET", pos: "TE",  pts: 16.5, proj: 14.0, status: "Active", byeWeek: 5,  seasonFpts: 184.8, seasonStats: { gp: 13, rec: 58, recYds: 624, recTd: 7 } },
  { id: "s7",  slot: "SFLEX", name: "Lamar Jackson",        nflTeam: "BAL", pos: "QB",  pts: 42.1, proj: 40.0, status: "Active", byeWeek: 14, seasonFpts: 448.2, seasonStats: { gp: 13, passYds: 3124, passTd: 28, passInt: 4, rushYds: 812, rushTd: 11 } },
  { id: "s8",  slot: "FLEX",  name: "Jahmyr Gibbs",         nflTeam: "DET", pos: "RB",  pts: 19.8, proj: 21.0, status: "Active", byeWeek: 5,  seasonFpts: 242.6, seasonStats: { gp: 13, rushYds: 924, rushTd: 9, rushAtt: 164, rec: 42, recYds: 348, recTd: 3 } },
  { id: "s9",  slot: "K",     name: "Harrison Butker",      nflTeam: "KC",  pos: "K",   pts: 8.0,  proj: 9.0,  status: "Active", byeWeek: 6,  seasonFpts: 142.0, seasonStats: { gp: 13, fgm: 28, fga: 31, xpm: 42 } },
  { id: "s10", slot: "DST",   name: "San Francisco 49ers",  nflTeam: "SF",  pos: "DST", pts: 12.0, proj: 11.0, status: "Active", byeWeek: 9,  seasonFpts: 168.4, seasonStats: { gp: 13, sacks: 42, defInt: 14, defTd: 4, pa: 18 } },
];

const MOCK_BENCH: Player[] = [
  { id: "b1", name: "Jaylen Waddle",       nflTeam: "MIA", pos: "WR",  pts: 11.2, proj: 13.0, status: "Active", isBench: true, byeWeek: 6,  seasonFpts: 162.4, seasonStats: { gp: 12, rec: 54, recYds: 724, recTd: 4 } },
  { id: "b2", name: "Tony Pollard",        nflTeam: "TEN", pos: "RB",  pts: 8.4,  proj: 10.0, status: "Active", isBench: true, byeWeek: 5,  seasonFpts: 138.6, seasonStats: { gp: 13, rushYds: 624, rushTd: 5, rushAtt: 148, rec: 22, recYds: 148 } },
  { id: "b3", name: "Kyle Pitts",          nflTeam: "ATL", pos: "TE",  pts: 7.6,  proj: 9.5,  status: "Q",      isBench: true, byeWeek: 12, seasonFpts: 124.8, seasonStats: { gp: 11, rec: 42, recYds: 548, recTd: 3 } },
  { id: "b4", name: "Gus Edwards",         nflTeam: "LAC", pos: "RB",  pts: 4.2,  proj: 6.0,  status: "Active", isBench: true, byeWeek: 5,  seasonFpts: 88.4,  seasonStats: { gp: 12, rushYds: 448, rushTd: 4, rushAtt: 112 } },
  { id: "b5", name: "Elijah Moore",        nflTeam: "CLE", pos: "WR",  pts: 6.8,  proj: 8.0,  status: "Active", isBench: true, byeWeek: 5,  seasonFpts: 96.2,  seasonStats: { gp: 13, rec: 38, recYds: 512, recTd: 3 } },
  { id: "b6", name: "Evan McPherson",      nflTeam: "CIN", pos: "K",   pts: 5.0,  proj: 7.0,  status: "Active", isBench: true, byeWeek: 7,  seasonFpts: 112.0, seasonStats: { gp: 13, fgm: 22, fga: 26, xpm: 34 } },
  { id: "b7", name: "Pittsburgh Steelers", nflTeam: "PIT", pos: "DST", pts: 9.0,  proj: 8.5,  status: "Active", isBench: true, byeWeek: 9,  seasonFpts: 134.6, seasonStats: { gp: 13, sacks: 34, defInt: 10, defTd: 2, pa: 22 } },
  { id: "b8", name: "Tyjae Spears",        nflTeam: "TEN", pos: "RB",  pts: 3.6,  proj: 5.0,  status: "Active", isBench: true, byeWeek: 5,  seasonFpts: 82.4,  seasonStats: { gp: 12, rushYds: 348, rushTd: 3, rushAtt: 88, rec: 18, recYds: 112 } },
  { id: "b9", name: "Christian McCaffrey", nflTeam: "SF",  pos: "RB",  pts: 0.0,  proj: 0.0,  status: "BYE",    isBench: true, byeWeek: 9,  seasonFpts: 188.2, seasonStats: { gp: 10, rushYds: 748, rushTd: 8, rushAtt: 148, rec: 52, recYds: 384, recTd: 4 } },
];

const STATUS_COLORS: Record<string, string> = {
  Active: "oklch(0.42 0.15 150)",
  Q:      "oklch(0.60 0.18 85)",
  D:      "oklch(0.55 0.22 25)",
  OUT:    "oklch(0.50 0.22 25)",
  IR:     "oklch(0.50 0.22 25)",
  BYE:    "oklch(0.50 0.02 150)",
};

const STATUS_BG: Record<string, string> = {
  Active: "oklch(0.94 0.05 150)",
  Q:      "oklch(0.97 0.08 85)",
  D:      "oklch(0.95 0.06 25)",
  OUT:    "oklch(0.95 0.06 25)",
  IR:     "oklch(0.95 0.06 25)",
  BYE:    "oklch(0.93 0.005 150)",
};

const POS_COLORS: Record<string, string> = {
  QB:  "oklch(0.42 0.18 260)",
  RB:  "oklch(0.38 0.15 150)",
  WR:  "oklch(0.42 0.18 220)",
  TE:  "oklch(0.55 0.16 85)",
  K:   "oklch(0.50 0.04 150)",
  DST: "oklch(0.45 0.18 25)",
};

// ── Current week (for bye conflict highlighting) ──────────────────────────────
const CURRENT_WEEK = 14;

// ── Season stats helper ─────────────────────────────────────────────────────
function buildSeasonStatChips(player: Player): { label: string; value: string }[] {
  const s = player.seasonStats;
  if (!s) return [];
  const chips: { label: string; value: string }[] = [];
  if (player.pos === "QB") {
    if (s.passYds)  chips.push({ label: "PYDS", value: s.passYds.toLocaleString() });
    if (s.passTd)   chips.push({ label: "PTD",  value: String(s.passTd) });
    if (s.passInt)  chips.push({ label: "INT",  value: String(s.passInt) });
    if (s.rushYds)  chips.push({ label: "RYDS", value: String(s.rushYds) });
    if (s.rushTd)   chips.push({ label: "RTD",  value: String(s.rushTd) });
  } else if (player.pos === "RB") {
    if (s.rushYds)  chips.push({ label: "RYDS", value: s.rushYds.toLocaleString() });
    if (s.rushTd)   chips.push({ label: "RTD",  value: String(s.rushTd) });
    if (s.rec)      chips.push({ label: "REC",  value: String(s.rec) });
    if (s.recYds)   chips.push({ label: "RCYDS",value: String(s.recYds) });
    if (s.recTd)    chips.push({ label: "RCTD", value: String(s.recTd) });
  } else if (player.pos === "WR" || player.pos === "TE") {
    if (s.rec)      chips.push({ label: "REC",  value: String(s.rec) });
    if (s.recYds)   chips.push({ label: "YDS",  value: s.recYds.toLocaleString() });
    if (s.recTd)    chips.push({ label: "TD",   value: String(s.recTd) });
  } else if (player.pos === "K") {
    if (s.fgm !== undefined && s.fga !== undefined)
      chips.push({ label: "FG", value: `${s.fgm}/${s.fga}` });
    if (s.xpm)      chips.push({ label: "XP",   value: String(s.xpm) });
  } else if (player.pos === "DST") {
    if (s.sacks)    chips.push({ label: "SACK", value: String(s.sacks) });
    if (s.defInt)   chips.push({ label: "INT",  value: String(s.defInt) });
    if (s.defTd)    chips.push({ label: "TD",   value: String(s.defTd) });
    if (s.pa)       chips.push({ label: "PA/G", value: String(s.pa) });
  }
  return chips;
}

function SeasonStatsRow({ player }: { player: Player }) {
  if (!player.seasonFpts && !player.byeWeek && !player.seasonStats) return null;
  const gp   = player.seasonStats?.gp ?? 0;
  const fpg  = gp > 0 && player.seasonFpts ? (player.seasonFpts / gp).toFixed(1) : null;
  const chips = buildSeasonStatChips(player);
  return (
    <div style={{
      display: "flex", flexWrap: "wrap" as const, alignItems: "center",
      gap: "0.3rem", marginTop: "0.3rem",
    }}>
      {/* Season FPTS */}
      {player.seasonFpts !== undefined && (
        <span style={{
          fontSize: "0.6rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
          padding: "1px 5px", borderRadius: 3,
          background: "oklch(0.92 0.06 150)", color: "oklch(0.28 0.09 150)",
          border: "1px solid oklch(0.84 0.08 150)", whiteSpace: "nowrap" as const,
        }}>
          {player.seasonFpts.toFixed(1)} FPTS
        </span>
      )}
      {/* FP/G */}
      {fpg && (
        <span style={{
          fontSize: "0.6rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
          padding: "1px 5px", borderRadius: 3,
          background: "oklch(0.94 0.04 85)", color: "oklch(0.38 0.14 85)",
          border: "1px solid oklch(0.86 0.07 85)", whiteSpace: "nowrap" as const,
        }}>
          {fpg}/G
        </span>
      )}
      {/* Bye week — red if current week conflict */}
      {player.byeWeek !== undefined && (() => {
        const isByeConflict = player.byeWeek === CURRENT_WEEK;
        return (
          <span style={{
            fontSize: "0.6rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
            padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" as const,
            background: isByeConflict ? "oklch(0.92 0.12 25)" : "oklch(0.93 0.005 150)",
            color:      isByeConflict ? "oklch(0.45 0.20 25)" : "oklch(0.52 0.02 150)",
            border:     isByeConflict ? "1px solid oklch(0.82 0.14 25)" : "1px solid oklch(0.85 0.01 150)",
          }}>
            {isByeConflict ? `⚠ BYE ${player.byeWeek}` : `BYE ${player.byeWeek}`}
          </span>
        );
      })()}
      {/* Season stat chips */}
      {chips.map((c, i) => (
        <span key={i} style={{
          fontSize: "0.58rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600,
          padding: "1px 4px", borderRadius: 3,
          background: "oklch(0.95 0.005 150)", color: "oklch(0.42 0.04 150)",
          border: "1px solid oklch(0.88 0.01 150)", whiteSpace: "nowrap" as const,
        }}>
          {c.label} {c.value}
        </span>
      ))}
    </div>
  );
}

function GameInfo({ nflTeam }: { nflTeam: string }) {
  const game = NFL_GAMES[nflTeam];
  if (!game) return (
    <span style={{
      fontSize: "0.62rem",
      fontFamily: "Barlow Condensed, sans-serif",
      fontWeight: 700,
      letterSpacing: "0.06em",
      padding: "1px 7px",
      borderRadius: 3,
      background: "oklch(0.92 0.005 150)",
      color: "oklch(0.52 0.02 150)",
      border: "1px solid oklch(0.82 0.01 150)",
      whiteSpace: "nowrap" as const,
    }}>BYE</span>
  );
  const dayColor = DAY_COLORS[game.day] || "oklch(0.5 0.04 150)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" as const }}>
      <span style={{
        fontSize: "0.62rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
        padding: "1px 5px", borderRadius: 3,
        background: dayColor + "22",
        color: dayColor,
        border: `1px solid ${dayColor}44`,
        whiteSpace: "nowrap" as const,
      }}>{game.day} {game.time}</span>
      <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", whiteSpace: "nowrap" as const }}>
        {game.home ? "vs" : "@"} <strong style={{ color: "oklch(0.35 0.06 150)" }}>{game.opp}</strong>
      </span>
    </div>
  );
}

// ── Convert real roster to Lineup Player shape ────────────────────────────────
function buildRealRoster(teamName: string | undefined): { starters: Player[]; bench: Player[] } {
  const team = TEAMS.find(t => t.teamName === teamName);
  if (!team) return { starters: MOCK_STARTERS, bench: MOCK_BENCH };

  const allPlayers: Player[] = team.players.map((rp, i) => ({
    id: rp.id,
    name: rp.name,
    pos: rp.pos,
    nflTeam: rp.nflTeam,
    pts: 0,
    proj: 0,
    status: "Active",
    byeWeek: rp.byeWeek ?? undefined,
    seasonFpts: undefined,
    seasonStats: undefined,
    isBench: false,
  }));

  // Assign starter slots greedily by position order
  const pool = [...allPlayers];
  const starters: Player[] = [];
  for (const slotDef of STARTER_SLOTS) {
    const idx = pool.findIndex(p => slotDef.eligible.includes(p.pos));
    if (idx !== -1) {
      const [player] = pool.splice(idx, 1);
      starters.push({ ...player, slot: slotDef.slot, isBench: false });
    }
  }
  const bench = pool.map(p => ({ ...p, isBench: true }));
  return { starters, bench };
}

export default function Lineup() {
  const { franchise } = useAuth();
  const { rostersByTeam, hasPicks, loading: draftLoading } = useDraftedRoster();

  // Build roster from live draft picks or fall back to static
  const liveRoster = useMemo(() => {
    if (!hasPicks || !franchise?.team_name) return null;
    const players = rostersByTeam[franchise.team_name];
    if (!players || players.length === 0) return null;
    const allPlayers: Player[] = players.map((rp, i) => ({
      id: rp.id,
      name: rp.name,
      pos: rp.pos,
      nflTeam: rp.nflTeam,
      pts: 0,
      proj: 0,
      status: "Active",
      byeWeek: rp.byeWeek ?? undefined,
      seasonFpts: undefined,
      seasonStats: undefined,
      isBench: false,
    }));
    const pool = [...allPlayers];
    const starters: Player[] = [];
    for (const slotDef of STARTER_SLOTS) {
      const idx = pool.findIndex(p => slotDef.eligible.includes(p.pos));
      if (idx !== -1) {
        const [player] = pool.splice(idx, 1);
        starters.push({ ...player, slot: slotDef.slot, isBench: false });
      }
    }
    const bench = pool.map(p => ({ ...p, isBench: true }));
    return { starters, bench };
  }, [rostersByTeam, hasPicks, franchise?.team_name]);

  const { starters: initialStarters, bench: initialBench } = useMemo(
    () => liveRoster ?? buildRealRoster(franchise?.team_name),
    [liveRoster, franchise?.team_name]
  );

  const [starters, setStarters] = useState<Player[]>(initialStarters);
  const [bench, setBench] = useState<Player[]>(initialBench);

  // Re-seed when live roster arrives (draft picks come in after initial mount)
  useEffect(() => {
    if (liveRoster) {
      setStarters(liveRoster.starters);
      setBench(liveRoster.bench);
    }
  }, [liveRoster]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const lineupLocked = false;

  const totalPts  = starters.reduce((s, p) => s + p.pts,  0);
  const totalProj = starters.reduce((s, p) => s + p.proj, 0);

  // ── Best Lineup Optimizer ──────────────────────────────────────────────────
  // For each slot (in order), find the highest-projected eligible player from
  // the combined pool, assign them, then remove from available pool.
  const runOptimizer = () => {
    const allPlayers = [...starters, ...bench];
    const available  = [...allPlayers]; // pool shrinks as we assign
    const newStarters: Player[] = [];

    for (const slotDef of STARTER_SLOTS) {
      // Find highest-projected eligible player not yet assigned
      const eligible = available
        .filter(p => slotDef.eligible.includes(p.pos))
        .sort((a, b) => b.proj - a.proj);

      if (eligible.length > 0) {
        const best = eligible[0];
        newStarters.push({ ...best, slot: slotDef.slot, isBench: false });
        available.splice(available.findIndex(p => p.id === best.id), 1);
      }
    }

    // Remaining players go to bench
    const newBench = available.map(p => ({ ...p, slot: undefined, isBench: true }));

    setStarters(newStarters);
    setBench(newBench);
    setSelectedId(null);
    setOptimized(true);
    setTimeout(() => setOptimized(false), 2500);
  };

  // ── Swap helpers ──────────────────────────────────────────────────────────
  const getEligibleBench = (slotKey: string): Player[] => {
    const slotDef = STARTER_SLOTS.find(s => s.slot === slotKey);
    if (!slotDef) return bench;
    return bench.filter(b => slotDef.eligible.includes(b.pos));
  };

  const getEligibleSlots = (benchPlayer: Player) =>
    STARTER_SLOTS.filter(s => s.eligible.includes(benchPlayer.pos));

  const doSwap = (starterId: string, benchId: string) => {
    const si = starters.findIndex(p => p.id === starterId);
    const bi = bench.findIndex(p => p.id === benchId);
    if (si === -1 || bi === -1) return;
    const ns = [...starters];
    const nb = [...bench];
    const slot = ns[si].slot;
    const tmp  = { ...ns[si] };
    ns[si] = { ...nb[bi], slot, isBench: false };
    nb[bi] = { ...tmp, slot: undefined, isBench: true };
    setStarters(ns);
    setBench(nb);
    setSelectedId(null);
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>My Lineup</h1>
            <p>{franchise?.team_name || "Select a team"} — Week 14 · Lock: Sun 1:00pm ET</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
            {/* Best Lineup button */}
            {!lineupLocked && (
              <button
                onClick={runOptimizer}
                style={{
                  background: optimized ? "oklch(0.55 0.16 85)" : "oklch(0.55 0.18 85)",
                  color: "white", border: "none", borderRadius: 8,
                  padding: "0.5rem 1.1rem",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase" as const,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem",
                  transition: "background 0.2s",
                  boxShadow: "0 2px 8px oklch(0.55 0.16 85 / 0.35)",
                }}
              >
                <Zap size={13} />
                {optimized ? "Optimized!" : "Best Lineup"}
              </button>
            )}
            {/* Save button */}
            {lineupLocked ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.875rem" }}>
                <Lock size={14} color="#ef4444" />
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", color: "#ef4444", letterSpacing: "0.04em" }}>LINEUP LOCKED</span>
              </div>
            ) : (
              <button onClick={handleSave} style={{
                background: saved ? "oklch(0.42 0.15 150)" : "oklch(0.28 0.09 150)",
                color: "white", border: "none", borderRadius: 8,
                padding: "0.5rem 1.25rem",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
                cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
                transition: "background 0.2s",
              }}>
                {saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Lineup"}
              </button>
            )}
          </div>
        </div>

        {/* ── Points summary bar ── */}
        <div style={{
          background: "oklch(0.18 0.06 150)", borderRadius: 10,
          padding: "0.6rem 1.25rem", display: "flex", gap: "2rem",
          marginBottom: "1rem", flexWrap: "wrap" as const,
        }}>
          <div>
            <div style={{ fontSize: "0.62rem", color: "oklch(0.75 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Total Points</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "oklch(0.88 0.15 85)", lineHeight: 1 }}>{totalPts.toFixed(1)}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.62rem", color: "oklch(0.75 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Projected</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "white", lineHeight: 1 }}>{totalProj.toFixed(1)}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", color: "oklch(0.75 0.06 150)" }}>
              {lineupLocked ? "Lineup is locked" : "Tap a player to swap · ⚡ Best Lineup auto-optimizes"}
            </span>
          </div>
        </div>

        {/* ── STARTERS ── */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Starting Lineup
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.78 0.15 85)" }}>{totalPts.toFixed(1)} pts · Proj {totalProj.toFixed(1)}</span>
          </div>

          {STARTER_SLOTS.map(({ slot, label }) => {
            const player    = starters.find(p => p.slot === slot);
            const isSelected = selectedId === player?.id;
            const eligibleBench = getEligibleBench(slot);

            return (
              <div key={slot}>
                <div
                  onClick={() => { if (lineupLocked || !player) return; setSelectedId(isSelected ? null : player.id); }}
                  className={!lineupLocked && player ? "wrc-row-hover" : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.6rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: lineupLocked ? "default" : "pointer",
                    background: isSelected ? "oklch(0.94 0.04 150)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  {/* Slot badge */}
                  <div style={{
                    width: 52, textAlign: "center",
                    fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                    letterSpacing: "0.06em", color: "white",
                    background: player ? POS_COLORS[player.pos] || "oklch(0.5 0.04 150)" : "oklch(0.75 0.02 150)",
                    borderRadius: 4, padding: "2px 0", flexShrink: 0,
                  }}>{slot}</div>

                  {player ? (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {player.name}
                          {player.pos === "TE" && (
                            <span style={{ marginLeft: 6, fontSize: "0.58rem", background: "oklch(0.92 0.1 85)", color: "oklch(0.35 0.15 85)", borderRadius: 3, padding: "1px 4px", fontWeight: 700 }}>1.5x</span>
                          )}
                        </div>
                        {/* Game info line */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px", flexWrap: "wrap" as const }}>
                          <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</span>
                          <GameInfo nflTeam={player.nflTeam} />
                        </div>
                        {/* Season stats row */}
                        <SeasonStatsRow player={player} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        <span style={{
                          fontSize: "0.62rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                          padding: "1px 5px", borderRadius: 3,
                          background: STATUS_BG[player.status] || "oklch(0.94 0.02 150)",
                          color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)",
                        }}>{player.status}</span>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                          <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                        </div>
                        {!lineupLocked && (isSelected ? <X size={14} color="oklch(0.5 0.04 150)" /> : <ChevronDown size={14} color="oklch(0.7 0.04 150)" />)}
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, color: "oklch(0.7 0.02 150)", fontSize: "0.85rem", fontStyle: "italic" }}>Empty — {label}</div>
                  )}
                </div>

                {/* Inline swap panel — starter selected */}
                {isSelected && !lineupLocked && (
                  <div style={{ background: "oklch(0.96 0.02 150)", borderBottom: "1px solid oklch(0.88 0.01 150)", padding: "0.5rem 1rem 0.75rem" }}>
                    <div style={{ fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      Replace with bench player:
                    </div>
                    {eligibleBench.length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "oklch(0.6 0.04 150)", fontStyle: "italic" }}>No eligible bench players for this slot</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
                        {eligibleBench.map(bp => (
                          <div
                            key={bp.id}
                            onClick={(e) => { e.stopPropagation(); doSwap(player!.id, bp.id); }}
                            style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.5rem 0.75rem", background: "white", borderRadius: 6, border: "1px solid oklch(0.88 0.01 150)", cursor: "pointer", transition: "background 0.1s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.92 0.04 150)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "white")}
                          >
                            <div style={{ width: 36, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "white", background: POS_COLORS[bp.pos] || "oklch(0.5 0.04 150)", borderRadius: 3, padding: "2px 0", flexShrink: 0 }}>{bp.pos}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bp.name}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "2px", flexWrap: "wrap" as const }}>
                                <span style={{ fontSize: "0.65rem", color: "oklch(0.55 0.04 150)" }}>{bp.nflTeam}</span>
                                <GameInfo nflTeam={bp.nflTeam} />
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.6rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", padding: "1px 5px", borderRadius: 3, background: STATUS_BG[bp.status] || "oklch(0.94 0.02 150)", color: STATUS_COLORS[bp.status] || "oklch(0.5 0.04 150)" }}>{bp.status}</span>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>{bp.pts.toFixed(1)}</div>
                                <div style={{ fontSize: "0.6rem", color: "oklch(0.6 0.04 150)" }}>Proj {bp.proj.toFixed(1)}</div>
                              </div>
                              <ArrowLeftRight size={13} color="oklch(0.28 0.09 150)" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── BENCH ── */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Bench
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.6 0.04 150)" }}>{bench.length} players</span>
          </div>

          {bench.map((player) => {
            const isSelected    = selectedId === player.id;
            const eligibleSlots = getEligibleSlots(player);

            return (
              <div key={player.id}>
                <div
                  onClick={() => { if (lineupLocked) return; setSelectedId(isSelected ? null : player.id); }}
                  className={!lineupLocked ? "wrc-row-hover" : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.6rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: lineupLocked ? "default" : "pointer",
                    background: isSelected ? "oklch(0.94 0.04 150)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  <div style={{ width: 52, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: "white", background: POS_COLORS[player.pos] || "oklch(0.5 0.04 150)", borderRadius: 4, padding: "2px 0", flexShrink: 0 }}>{player.pos}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px", flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</span>
                      <GameInfo nflTeam={player.nflTeam} />
                    </div>
                    {/* Season stats row */}
                    <SeasonStatsRow player={player} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", padding: "1px 5px", borderRadius: 3, background: STATUS_BG[player.status] || "oklch(0.94 0.02 150)", color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)" }}>{player.status}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                      <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                    </div>
                    {!lineupLocked && (isSelected ? <X size={14} color="oklch(0.5 0.04 150)" /> : <ChevronDown size={14} color="oklch(0.7 0.04 150)" />)}
                  </div>
                </div>

                {/* Inline swap panel — bench player selected */}
                {isSelected && !lineupLocked && (
                  <div style={{ background: "oklch(0.96 0.02 150)", borderBottom: "1px solid oklch(0.88 0.01 150)", padding: "0.5rem 1rem 0.75rem" }}>
                    <div style={{ fontSize: "0.65rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                      Move to starting slot:
                    </div>
                    {eligibleSlots.length === 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "oklch(0.6 0.04 150)", fontStyle: "italic" }}>No eligible starting slots</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
                        {eligibleSlots.map(slotDef => {
                          const currentStarter = starters.find(s => s.slot === slotDef.slot);
                          return (
                            <div
                              key={slotDef.slot}
                              onClick={(e) => { e.stopPropagation(); if (currentStarter) doSwap(currentStarter.id, player.id); }}
                              style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.5rem 0.75rem", background: "white", borderRadius: 6, border: "1px solid oklch(0.88 0.01 150)", cursor: "pointer", transition: "background 0.1s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.92 0.04 150)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "white")}
                            >
                              <div style={{ width: 52, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "white", background: "oklch(0.28 0.09 150)", borderRadius: 3, padding: "2px 0", flexShrink: 0 }}>{slotDef.slot}</div>
                              {currentStarter ? (
                                <>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStarter.name}</div>
                                    <div style={{ fontSize: "0.65rem", color: "oklch(0.6 0.04 150)" }}>moves to bench</div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.22 0.08 150)" }}>{currentStarter.pts.toFixed(1)}</div>
                                      <div style={{ fontSize: "0.6rem", color: "oklch(0.6 0.04 150)" }}>Proj {currentStarter.proj.toFixed(1)}</div>
                                    </div>
                                    <ArrowLeftRight size={13} color="oklch(0.28 0.09 150)" />
                                  </div>
                                </>
                              ) : (
                                <div style={{ flex: 1, color: "oklch(0.6 0.04 150)", fontSize: "0.82rem", fontStyle: "italic" }}>Empty slot — insert {player.name}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
