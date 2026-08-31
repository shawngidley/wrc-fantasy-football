/**
 * WRC Fantasy Football - Lineup Page
 * Layout: Starters on top (full width), Bench below (full width)
 * Features: Best Lineup optimizer, per-player game info (day/time/opp/location), inline swap panel
 * TE Premium: 1.5x PPR for TE position regardless of slot
 */
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, CheckCircle2, ChevronDown, ArrowLeftRight, X, Zap, Eye, ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { useDraftedRoster } from "@/hooks/useDraftedRoster";
import { useParams, Link, useLocation } from "wouter";
import TeamLogo from "@/components/TeamLogo";
import { useNFLMatchups, formatMatchup, formatGameTime, type NFLMatchupMap } from "@/hooks/useNFLMatchups";
import { useNFLProjections, getProjectedPoints } from "@/hooks/useNFLProjections";
import { useLineupPersistence } from "@/hooks/useLineupPersistence";
import { useNFLLiveScores, getLivePoints } from "@/hooks/useNFLLiveScores";
import { useWeeklyResultsWriter } from "@/hooks/useWeeklyResultsWriter";
import { useNFLInjuries, getInjuryDesignation, getInjuryColor, getInjuryLabel } from "@/hooks/useNFLInjuries";
import { useNFLSeasonStats } from "@/hooks/useNFLSeasonStats";
import { formatSeasonStat, type PlayerSeasonStats } from "@/lib/playerSeasonStats";
import { getNflTeamLogoUrl } from "@/lib/nflTeamLogo";
import { fetchTeamSchedule } from "@/hooks/useNFLTeamSchedule";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { NFL_PLAYERS_2026 } from "@/lib/nflPlayers2026";
import { supabase } from "@/lib/supabase";
import { getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";

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

/** Stable selection key across Tank01, draft, and Supabase player-name variants. */
// Delegates to the shared canonical normalizer so a roster player uploaded
// as e.g. "James Cook" still matches NFL_PLAYERS_2026/live data returning
// "James Cook III" for the same person.
const lineupPlayerKey = normalizePlayerName;

// NFL_GAMES static table removed — replaced by live useNFLMatchups hook

const DAY_COLORS: Record<string, string> = {
  Thu: "oklch(0.55 0.18 260)",
  Sun: "oklch(0.38 0.15 150)",
  Mon: "oklch(0.55 0.18 25)",
  Sat: "oklch(0.55 0.16 85)",
};

// ── NFL team abbreviation normalizer (KAN→KC, TAM→TB, ARZ→ARI, JAX→JAC) ────────
function normalizeNFLTeam(abv: string): string {
  const map: Record<string, string> = {
    KAN: "KC", TAM: "TB", ARZ: "ARI", JAX: "JAC", WAS: "WSH",
  };
  return map[abv.toUpperCase()] ?? abv.toUpperCase();
}

/**
 * Returns true if the player's NFL game has already started (ET).
 * A player locks the moment their game kicks off — not at a global Sunday 1pm.
 */
function isPlayerLocked(nflTeam: string, matchupMap: NFLMatchupMap): boolean {
  const normTeam = normalizeNFLTeam(nflTeam);
  const matchup = matchupMap[normTeam];
  if (!matchup) return false; // no game this week → not locked (bye)
  const { gameDate, gameTime } = matchup;
  if (!gameDate || !gameTime) return false;

  // Parse gameDate: "20260913" → "2026-09-13"
  const d = gameDate;
  const datePart = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;

  // Parse gameTime: "1:00p" or "8:20p" (Eastern)
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;

  // Build an ISO string in ET (UTC-4 during EDT, UTC-5 during EST)
  // September games are EDT (UTC-4)
  const offsetHours = 4; // EDT
  const utcHours = hours + offsetHours;
  const kickoffUTC = new Date(`${datePart}T${String(utcHours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:00Z`);

  return Date.now() >= kickoffUTC.getTime();
}

// ── GameInfo now accepts the live matchup map passed from the parent ──────────

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

function GameInfo({ nflTeam, matchupMap }: { nflTeam: string; matchupMap: NFLMatchupMap }) {
  const m = matchupMap[nflTeam];
  if (!m) return (
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
  const timeStr = formatGameTime(m);   // e.g. "Sun 1:00p ET"
  const day = timeStr.split(" ")[0];   // "Sun", "Mon", "Thu", etc.
  const dayColor = DAY_COLORS[day] || "oklch(0.5 0.04 150)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" as const }}>
      <span style={{
        fontSize: "0.62rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700,
        padding: "1px 5px", borderRadius: 3,
        background: dayColor + "22",
        color: dayColor,
        border: `1px solid ${dayColor}44`,
        whiteSpace: "nowrap" as const,
      }}>{timeStr}</span>
      <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", whiteSpace: "nowrap" as const }}>
        {m.isHome ? "vs" : "@"} <strong style={{ color: "oklch(0.35 0.06 150)" }}>{m.opponent}</strong>
      </span>
    </div>
  );
}

export function mobileLineupName(player: Pick<Player, "name" | "pos">): string {
  if (player.pos === "DST") return player.name;
  const parts = player.name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : player.name;
}

function LineupIdentity({ player, meta }: { player: Player; meta?: { age?: string; headshot?: string } }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isEmpty = player.name === "";
  const initials = player.name.split(" ").map(part => part[0]).slice(0, 2).join("");
  const canonicalHeadshot = getEspnHeadshotUrl(getDraftUniversePlayerByName(player.name)?.sourcePlayerId);
  const identityImage = player.pos === "DST" ? getNflTeamLogoUrl(player.nflTeam) : meta?.headshot ?? canonicalHeadshot;
  if (isEmpty) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--lineup-identity-gap)", minWidth: 0 }}>
        <span style={{ display: "grid", placeItems: "center", width: "var(--lineup-avatar-size)", height: "var(--lineup-avatar-size)", borderRadius: "50%", border: "1.5px dashed oklch(0.7 0.02 150)", color: "oklch(0.6 0.02 150)", fontSize: "0.6rem", fontWeight: 800, flexShrink: 0 }}>+</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "oklch(0.55 0.03 150)", fontWeight: 700, fontSize: "var(--lineup-player-name-size)", fontStyle: "italic" }}>Empty — click to add</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--lineup-identity-gap)", minWidth: 0 }}>
      {identityImage && !imageFailed ? (
        <img src={identityImage} alt={player.pos === "DST" ? `${player.nflTeam} logo` : ""} onError={() => setImageFailed(true)} style={{ width: "var(--lineup-avatar-size)", height: "var(--lineup-avatar-size)", borderRadius: player.pos === "DST" ? 4 : "50%", objectFit: "contain", background: "oklch(0.98 0.005 150)", padding: player.pos === "DST" ? 1 : 0 }} />
      ) : (
        <span style={{ display: "grid", placeItems: "center", width: "var(--lineup-avatar-size)", height: "var(--lineup-avatar-size)", borderRadius: "50%", background: POS_COLORS[player.pos] || "oklch(0.45 0.04 150)", color: "white", fontSize: "0.55rem", fontWeight: 800, flexShrink: 0 }}>{initials}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div aria-label={player.name} style={{ color: "oklch(0.2 0.09 250)", fontWeight: 800, fontSize: "var(--lineup-player-name-size)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span className="lineup-player-name-full" aria-hidden="true">{player.name}</span><span className="lineup-player-name-compact" aria-hidden="true">{mobileLineupName(player)}</span></div>
        <div style={{ fontSize: "var(--lineup-player-meta-size)", color: "oklch(0.48 0.05 150)", fontWeight: 700 }}>{player.pos} · {player.nflTeam}{player.pos === "TE" ? " · 1.5×" : ""}</div>
      </div>
    </div>
  );
}

export function LineupRosterTable({
  title, profile, players, statMap, metaMap, matchupMap, injuries, selectedId, isReadOnly, onSelect, onPlayerClick, getInlineChoices, onInlineSwap,
}: {
  title: string;
  profile: "SFLEX" | "K" | "DST";
  players: Player[];
  statMap: Record<string, PlayerSeasonStats>;
  metaMap: Record<string, { age?: string; headshot?: string }>;
  matchupMap: NFLMatchupMap;
  injuries: unknown;
  selectedId: string | null;
  isReadOnly: boolean;
  onSelect: (player: Player) => void;
  onPlayerClick: (player: Player) => void;
  getInlineChoices: (player: Player) => Player[];
  onInlineSwap: (source: Player, candidate: Player) => void;
}) {
  const thStyle = { padding: "0.4rem 0.42rem", background: "oklch(0.98 0.006 150)", color: "oklch(0.28 0.08 150)", borderBottom: "1px solid oklch(0.84 0.02 150)", textAlign: "center" as const, fontSize: "var(--lineup-column-label-size)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, letterSpacing: "0.05em", whiteSpace: "nowrap" as const };
  const groupStyle = { ...thStyle, background: "oklch(0.94 0.025 150)", color: "oklch(0.34 0.08 150)", fontSize: "var(--lineup-group-label-size)" };
  const tdStyle = { padding: "0.47rem 0.42rem", borderBottom: "1px solid oklch(0.92 0.008 150)", textAlign: "center" as const, color: "oklch(0.28 0.05 150)", fontSize: "var(--lineup-data-size)", fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const };
  const value = (stats: PlayerSeasonStats | undefined, key: keyof PlayerSeasonStats, decimals = 0) => stats ? formatSeasonStat(stats[key], decimals) : "—";
  const decisionHeaders = ["AGE", "BYE", "OPP", "GAME"];
  const fantasyHeaders = ["PROJ", "FPTS", "FP/G"];
  const primaryHeaders = profile === "SFLEX"
    ? ["YDS", "TD", "INT", "ATT", "YDS", "TD", "TGT", "REC", "YDS", "TD", "TO", "GP"]
    : profile === "K"
      ? ["FGM", "FGA", "FG%", "XPM", "XPA", "XP%", "GP"]
      : ["SK", "SFT", "TA", "TDDST", "GP"];
  const slotWidth = "var(--lineup-slot-column-width)";
  const playerWidth = "var(--lineup-player-column-width)";
  const columnCount = 2 + decisionHeaders.length + primaryHeaders.length + fantasyHeaders.length;
  const minWidth = profile === "SFLEX" ? 980 : profile === "K" ? 830 : 710;

  return (
    <section className="wrc-card lineup-table-panel" style={{ marginBottom: "1rem", overflow: "hidden" }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header">{title}<span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "oklch(0.58 0.04 150)", fontWeight: 600 }}>Swipe table for full season detail</span></div>
      <div className="lineup-table-scroll" style={{ overflowX: "auto", overflowY: "visible", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}>
        <table style={{ minWidth, width: "max-content", borderCollapse: "separate", borderSpacing: 0, background: "white" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...groupStyle, position: "sticky", left: 0, zIndex: 4, minWidth: slotWidth }}>SLOT</th>
              <th rowSpan={2} style={{ ...groupStyle, position: "sticky", left: slotWidth, zIndex: 4, minWidth: playerWidth, textAlign: "left" }}>PLAYER</th>
              <th colSpan={4} style={groupStyle}>WEEKLY DECISION</th><th colSpan={3} style={groupStyle}>FANTASY</th>
              {profile === "SFLEX" && <><th colSpan={3} style={groupStyle}>PASS</th><th colSpan={3} style={groupStyle}>RUSH</th><th colSpan={4} style={groupStyle}>REC</th><th colSpan={1} style={groupStyle}>TO</th><th colSpan={1} style={groupStyle}>SEASON</th></>}
              {profile === "K" && <><th colSpan={6} style={groupStyle}>KICKING</th><th colSpan={1} style={groupStyle}>SEASON</th></>}
              {profile === "DST" && <><th colSpan={4} style={groupStyle}>DEFENSE</th><th colSpan={1} style={groupStyle}>SEASON</th></>}
            </tr>
            <tr>{[...decisionHeaders, ...fantasyHeaders, ...primaryHeaders].map((label, index) => <th key={`${label}-${index}`} style={thStyle}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const stats = statMap[player.name.toLowerCase()];
              const meta = metaMap[player.name.toLowerCase()];
              const matchup = matchupMap[player.nflTeam];
              const injury = getInjuryDesignation(injuries as never, player.name);
              const injuryColor = injury ? getInjuryColor(injury) : null;
              const selected = selectedId === lineupPlayerKey(player.name);
              const locked = isPlayerLocked(player.nflTeam, matchupMap);
              const rowBg = selected
                ? "oklch(0.96 0.06 85)"
                : locked
                  ? "oklch(0.98 0.012 25)"
                  : player.isBench
                    ? "oklch(0.91 0.025 85)"
                    : "white";
              const benchPinnedOutline = player.isBench
                ? "inset 0 1px 0 oklch(0.76 0.07 85 / 0.75), inset 0 -1px 0 oklch(0.76 0.07 85 / 0.75)"
                : undefined;
              const choices = selected && !isReadOnly ? getInlineChoices(player) : [];
              return <Fragment key={player.id}><tr style={{ background: rowBg }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 2, background: rowBg, boxShadow: benchPinnedOutline }}><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(player); }} disabled={isReadOnly || locked} aria-label={`Change ${player.name} in ${player.slot ?? "bench"}`} title={isReadOnly ? "View only" : locked ? "Player locked" : "Change player"} style={{ display: "grid", placeItems: "center", minWidth: "var(--lineup-slot-button-width)", minHeight: 24, border: selected ? "1px solid oklch(0.62 0.16 85)" : "none", borderRadius: 4, background: selected ? "oklch(0.52 0.16 85)" : POS_COLORS[player.pos] || "oklch(0.5 0.04 150)", color: "white", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "var(--lineup-slot-font-size)", cursor: isReadOnly || locked ? "default" : "pointer", opacity: locked ? 0.6 : 1 }}>{locked ? <Lock size={11} aria-label="Locked" /> : <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>{player.slot ?? "BN"}{!isReadOnly && <ChevronDown size={10} />}</span>}</button></td>
                <td onClick={() => onPlayerClick(player)} style={{ ...tdStyle, position: "sticky", left: slotWidth, zIndex: 2, minWidth: playerWidth, maxWidth: playerWidth, textAlign: "left", cursor: "pointer", background: rowBg, boxShadow: benchPinnedOutline }}><LineupIdentity player={player} meta={meta} /></td>
                <td style={tdStyle}>{meta?.age || "—"}</td><td style={tdStyle}>{player.byeWeek ?? "—"}</td><td style={tdStyle}>{matchup ? `${matchup.isHome ? "vs" : "@"} ${matchup.opponent}` : "BYE"}</td><td style={{ ...tdStyle, maxWidth: 86, overflow: "hidden", textOverflow: "ellipsis" }}>{matchup ? formatGameTime(matchup).replace(" ET", "") : "—"}</td>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{player.proj.toFixed(1)}</td><td style={{ ...tdStyle, color: "oklch(0.45 0.13 85)", fontWeight: 800 }}>{value(stats, "wrcPts", 1)}</td><td style={{ ...tdStyle, color: "oklch(0.45 0.13 85)", fontWeight: 800 }}>{value(stats, "ptsPerGame", 1)}</td>
                {profile === "SFLEX" && <><td style={tdStyle}>{value(stats, "passYds")}</td><td style={tdStyle}>{value(stats, "passTD")}</td><td style={tdStyle}>{value(stats, "passInt")}</td><td style={tdStyle}>{value(stats, "rushAtt")}</td><td style={tdStyle}>{value(stats, "rushYds")}</td><td style={tdStyle}>{value(stats, "rushTD")}</td><td style={tdStyle}>{value(stats, "targets")}</td><td style={tdStyle}>{value(stats, "receptions")}</td><td style={tdStyle}>{value(stats, "recYds")}</td><td style={tdStyle}>{value(stats, "recTD")}</td><td style={tdStyle}>{stats ? stats.passInt + stats.fumblesLost : "—"}</td><td style={tdStyle}>{value(stats, "gp")}</td></>}
                {profile === "K" && <><td style={tdStyle}>{value(stats, "fgMade")}</td><td style={tdStyle}>{value(stats, "fgAtt")}</td><td style={tdStyle}>{stats?.fgAtt && stats.fgAtt > 0 ? `${Math.round(((stats.fgMade ?? 0) / stats.fgAtt) * 100)}%` : "—"}</td><td style={tdStyle}>{value(stats, "xpMade")}</td><td style={tdStyle}>{value(stats, "xpAtt")}</td><td style={tdStyle}>{stats?.xpAtt && stats.xpAtt > 0 ? `${Math.round(((stats.xpMade ?? 0) / stats.xpAtt) * 100)}%` : "—"}</td><td style={tdStyle}>{value(stats, "gp")}</td></>}
                {profile === "DST" && <><td style={tdStyle}>{value(stats, "sacks")}</td><td style={tdStyle}>{value(stats, "safeties")}</td><td style={tdStyle}>{value(stats, "takeaways")}</td><td style={tdStyle}>{value(stats, "dstTD")}</td><td style={tdStyle}>{value(stats, "gp")}</td></>}
              </tr>
              {selected && !isReadOnly && (
                <tr>
                  <td colSpan={columnCount} style={{ padding: "0.65rem 0.85rem", background: "oklch(0.965 0.04 85)", borderBottom: "1px solid oklch(0.8 0.1 85)", textAlign: "left" }}>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", letterSpacing: "0.05em", fontWeight: 800, color: "oklch(0.36 0.13 85)", marginBottom: "0.4rem" }}>ELIGIBLE PLAYERS TO SWAP WITH {player.name.toUpperCase()}</div>
                    {choices.length === 0 && <span style={{ fontSize: "0.76rem", color: "oklch(0.45 0.04 150)" }}>No eligible unlocked players are available for this swap.</span>}
                  </td>
                </tr>
              )}
              {selected && !isReadOnly && choices.map(candidate => {
                const candidateStats = statMap[candidate.name.toLowerCase()];
                const candidateMeta = metaMap[candidate.name.toLowerCase()];
                const candidateMatchup = matchupMap[candidate.nflTeam];
                const candidateBg = "oklch(0.985 0.025 85)";
                return <tr key={`${player.id}-${candidate.id}`} style={{ background: candidateBg }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 2, background: candidateBg }}><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onInlineSwap(player, candidate); }} aria-label={`Move ${candidate.name} into ${player.slot ?? "bench"}`} title={`Move ${candidate.name}`} style={{ display: "grid", placeItems: "center", minWidth: "var(--lineup-slot-button-width)", minHeight: 24, border: "1px solid oklch(0.62 0.16 85)", borderRadius: 4, background: "oklch(0.52 0.16 85)", color: "white", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "var(--lineup-slot-font-size)", cursor: "pointer" }}>{player.slot ?? "BN"}</button></td>
                  <td onClick={() => onPlayerClick(candidate)} style={{ ...tdStyle, position: "sticky", left: slotWidth, zIndex: 2, minWidth: playerWidth, maxWidth: playerWidth, textAlign: "left", cursor: "pointer", background: candidateBg }}><LineupIdentity player={candidate} meta={candidateMeta} /></td>
                  <td style={tdStyle}>{candidateMeta?.age || "—"}</td><td style={tdStyle}>{candidate.byeWeek ?? "—"}</td><td style={tdStyle}>{candidateMatchup ? `${candidateMatchup.isHome ? "vs" : "@"} ${candidateMatchup.opponent}` : "BYE"}</td><td style={{ ...tdStyle, maxWidth: 86, overflow: "hidden", textOverflow: "ellipsis" }}>{candidateMatchup ? formatGameTime(candidateMatchup).replace(" ET", "") : "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 800 }}>{candidate.proj.toFixed(1)}</td><td style={{ ...tdStyle, color: "oklch(0.45 0.13 85)", fontWeight: 800 }}>{value(candidateStats, "wrcPts", 1)}</td><td style={{ ...tdStyle, color: "oklch(0.45 0.13 85)", fontWeight: 800 }}>{value(candidateStats, "ptsPerGame", 1)}</td>
                  {profile === "SFLEX" && <><td style={tdStyle}>{value(candidateStats, "passYds")}</td><td style={tdStyle}>{value(candidateStats, "passTD")}</td><td style={tdStyle}>{value(candidateStats, "passInt")}</td><td style={tdStyle}>{value(candidateStats, "rushAtt")}</td><td style={tdStyle}>{value(candidateStats, "rushYds")}</td><td style={tdStyle}>{value(candidateStats, "rushTD")}</td><td style={tdStyle}>{value(candidateStats, "targets")}</td><td style={tdStyle}>{value(candidateStats, "receptions")}</td><td style={tdStyle}>{value(candidateStats, "recYds")}</td><td style={tdStyle}>{value(candidateStats, "recTD")}</td><td style={tdStyle}>{candidateStats ? candidateStats.passInt + candidateStats.fumblesLost : "—"}</td><td style={tdStyle}>{value(candidateStats, "gp")}</td></>}
                  {profile === "K" && <><td style={tdStyle}>{value(candidateStats, "fgMade")}</td><td style={tdStyle}>{value(candidateStats, "fgAtt")}</td><td style={tdStyle}>{candidateStats?.fgAtt && candidateStats.fgAtt > 0 ? `${Math.round(((candidateStats.fgMade ?? 0) / candidateStats.fgAtt) * 100)}%` : "—"}</td><td style={tdStyle}>{value(candidateStats, "xpMade")}</td><td style={tdStyle}>{value(candidateStats, "xpAtt")}</td><td style={tdStyle}>{candidateStats?.xpAtt && candidateStats.xpAtt > 0 ? `${Math.round(((candidateStats.xpMade ?? 0) / candidateStats.xpAtt) * 100)}%` : "—"}</td><td style={tdStyle}>{value(candidateStats, "gp")}</td></>}
                  {profile === "DST" && <><td style={tdStyle}>{value(candidateStats, "sacks")}</td><td style={tdStyle}>{value(candidateStats, "safeties")}</td><td style={tdStyle}>{value(candidateStats, "takeaways")}</td><td style={tdStyle}>{value(candidateStats, "dstTD")}</td><td style={tdStyle}>{value(candidateStats, "gp")}</td></>}
                </tr>;
              })}
              </Fragment>;
            })}
          </tbody>
        </table>
      </div>
    </section>
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
    } else {
      // No eligible player available for this slot -- push a placeholder
      // so the row still renders and is clickable. Previously an unfilled
      // slot was skipped entirely, meaning it never appeared as a row at
      // all, leaving no way to assign a bench player into it even when one
      // was eligible and available.
      starters.push({ id: `empty-${slotDef.slot}`, name: "", pos: "", nflTeam: "", pts: 0, proj: 0, status: "Empty", slot: slotDef.slot, isBench: false });
    }
  }
  const bench = pool.map(p => ({ ...p, isBench: true }));
  return { starters, bench };
}

// team_id → team_name lookup (matches Supabase teams table & OWNER_TO_TEAM)
export const TEAM_ID_TO_NAME: Record<string, string> = {
  "team-jonas":   "The Super Snuffleupagus",
  "team-davidr":  "The Boys of Fall",
  "team-jason":   "Heiden's Hardtimes",
  "team-keith":   "HamSandwich",
  "team-dan":     "Legion of Doom",
  "team-jamie":   "The Four Horsemen",
  "team-bill":    "Billy Goats Gruff",
  "team-scottn":  "Millertime",
  "team-shawn":   "Vipers",
  "team-davids":  "Legends",
  "team-greg":    'Larry "Bud" Melman123',
  "team-scottm":  "Xavier Musketeers",
};

// Reverse map: team name → team id (for building links from other pages)
export const TEAM_NAME_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_ID_TO_NAME).map(([id, name]) => [name, id])
);

export default function Lineup() {
  const { franchise } = useAuth();
  const [, navigate] = useLocation();
  const { teamId } = useParams<{ teamId?: string }>();
  const { rostersByTeam, hasPicks, loading: draftLoading } = useDraftedRoster();

  // League median from team_standings
  const [leagueMedian, setLeagueMedian] = useState<number | null>(null);
  useEffect(() => {
    supabase.from("team_standings").select("pts_for").then(({ data }) => {
      if (!data || data.length === 0) return;
      const pts = data.map((r: { pts_for: number }) => r.pts_for).sort((a: number, b: number) => a - b);
      const mid = Math.floor(pts.length / 2);
      const median = pts.length % 2 === 0 ? (pts[mid - 1] + pts[mid]) / 2 : pts[mid];
      setLeagueMedian(median);
    });
  }, []);

  // Determine which team to show and whether we are in read-only mode
  const viewTeamName = teamId ? (TEAM_ID_TO_NAME[teamId] ?? null) : franchise?.team_name;
  const isReadOnly = !!(teamId && franchise?.team_name !== viewTeamName);
  const isOwnerView = !teamId; // true when on /lineup (owner's own page)

  // Live NFL matchup + projection data from Tank01
  const currentWeek = getCurrentWeek() || 1;
  const { matchups: matchupMap } = useNFLMatchups(currentWeek);
  const { projections } = useNFLProjections(currentWeek);

  // Lineup persistence (Supabase) — only for owner's own lineup
  // Load saved lineup if: (a) on /lineup (owner's own page), or (b) on /lineup/team-X where team-X matches the logged-in owner
  const ownerTeamId = franchise?.id
    ? (!teamId || teamId === franchise.id ? franchise.id : null)
    : null;
  const { savedLineup, saveLineup, saving, saveError } = useLineupPersistence(
  ownerTeamId, currentWeek
);

  // Live in-game score polling (Tank01 box scores)
  const { liveScores, isPolling, lastUpdated, kickerEvents } = useNFLLiveScores(
    currentWeek, 2026, matchupMap
  );

  // Auto-write results once last game of week goes final (runs silently)
  // Only active on owner's own lineup page (not read-only views)
  useWeeklyResultsWriter(currentWeek, 2026, matchupMap, isOwnerView);

  // Injury designations from Tank01 (cached 3h in sessionStorage)
  const { injuries } = useNFLInjuries();
  const [byeWeeksByTeam, setByeWeeksByTeam] = useState<Record<string, number>>({});
  const displayedNflTeams = useMemo(
    () => Array.from(new Set((viewTeamName ? rostersByTeam[viewTeamName] ?? [] : []).map(player => normalizeNFLTeam(player.nflTeam)).filter(Boolean))).sort(),
    [rostersByTeam, viewTeamName],
  );

  useEffect(() => {
    if (!displayedNflTeams.length) return;
    let cancelled = false;
    Promise.all(displayedNflTeams.map(async team => {
      const schedule = await fetchTeamSchedule(team, 2026);
      const scheduledWeeks = new Set(schedule.map(game => game.weekNum).filter(week => week >= 1 && week <= 18));
      const byeWeek = Array.from({ length: 18 }, (_, index) => index + 1).find(week => !scheduledWeeks.has(week));
      return [team, byeWeek] as const;
    })).then(entries => {
      if (cancelled) return;
      const resolved = Object.fromEntries(entries.filter((entry): entry is [string, number] => entry[1] !== undefined));
      setByeWeeksByTeam(previous => {
        const next = { ...previous, ...resolved };
        return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [displayedNflTeams.join("|")]);

  // Build roster from Supabase (players table or draft_picks, whichever is populated)
  const liveRoster = useMemo(() => {
    if (!viewTeamName) return null;
    const players = rostersByTeam[viewTeamName];
    if (!players || players.length === 0) return null;
    const allPlayers: Player[] = players.map((rp) => {
      const staticPlayer = NFL_PLAYERS_2026.find(candidate => lineupPlayerKey(candidate.name) === lineupPlayerKey(rp.name));
      return ({
      id: rp.id,
      name: rp.name,
      pos: rp.pos,
      nflTeam: normalizeNFLTeam(rp.nflTeam),
      pts: 0,
      proj: 0,   // filled in below once projections arrive
      status: "Active",
      byeWeek: normalizeNFLTeam(rp.nflTeam) === "JAC"
        ? 7
        : byeWeeksByTeam[normalizeNFLTeam(rp.nflTeam)] ?? staticPlayer?.bye ?? rp.byeWeek ?? undefined,
      seasonFpts: undefined,
      seasonStats: undefined,
      isBench: false,
    });
    });
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
  }, [byeWeeksByTeam, rostersByTeam, viewTeamName]);

  const { starters: initialStarters, bench: initialBench } = useMemo(
    () => liveRoster ?? buildRealRoster(viewTeamName ?? undefined),
    [liveRoster, viewTeamName]
  );

  const [starters, setStarters] = useState<Player[]>(initialStarters);
  const [bench, setBench] = useState<Player[]>(initialBench);
  const lineupSeasonPlayers = useMemo(
    () => [...starters, ...bench].map(player => ({ name: player.name, pos: player.pos, nflTeam: player.nflTeam })),
    [starters, bench],
  );
  const { statMap: lineupStatMap, playerMetaMap: lineupMetaMap } = useNFLSeasonStats(
    lineupSeasonPlayers,
    Boolean(viewTeamName) && !draftLoading,
    false,
  );

  // Refs to always have latest starters/bench in effects without stale closures
  const benchRef = useRef<Player[]>([]);
  const startersRef = useRef<Player[]>([]);
  const savedLineupRef = useRef<Record<string, string> | null>(null);
  useEffect(() => { benchRef.current = bench; }, [bench]);
  useEffect(() => { startersRef.current = starters; }, [starters]);
  useEffect(() => { savedLineupRef.current = savedLineup; }, [savedLineup]);

  // Helper: apply projections to a player array (avoids race condition)
  const withProj = (players: Player[]) => {
    if (!projections || Object.keys(projections).length === 0) return players;
    return players.map(p => ({
      ...p,
      proj: getProjectedPoints(projections, p.name, p.pos, p.nflTeam),
    }));
  };

  // Combined effect: re-seed roster and apply saved lineup order.
  // Runs whenever liveRoster OR savedLineup changes so both load orders are handled.
  useEffect(() => {
    if (!liveRoster) return; // wait for roster to load
    const newStarters = withProj(liveRoster.starters);
    const newBench = withProj(liveRoster.bench);
    const allPlayers = [...newStarters, ...newBench];

    // If we have a saved lineup, apply it; otherwise use default order
    if (savedLineup && Object.keys(savedLineup).length > 0) {
      const pool = [...allPlayers];
      const reorderedStarters: typeof newStarters = [];
      for (const slotDef of STARTER_SLOTS) {
        // Match the saved player by normalized name, not an exact string
        // comparison -- a saved lineup entry could easily mismatch on
        // suffix/spacing differences (e.g. "James Cook" vs "James Cook III")
        // between when it was saved and how the roster's current player
        // list spells the same name, silently falling through to the
        // greedy default below and making it look like the saved slot
        // was never actually held.
        const savedName = savedLineup[slotDef.slot];
        let idx = savedName ? pool.findIndex(p => lineupPlayerKey(p.name) === lineupPlayerKey(savedName)) : -1;
        if (idx === -1) idx = pool.findIndex(p => slotDef.eligible.includes(p.pos));
        if (idx !== -1) {
          const [player] = pool.splice(idx, 1);
          reorderedStarters.push({ ...player, slot: slotDef.slot, isBench: false });
        } else {
          reorderedStarters.push({ id: `empty-${slotDef.slot}`, name: "", pos: "", nflTeam: "", pts: 0, proj: 0, status: "Empty", slot: slotDef.slot, isBench: false });
        }
      }
      setStarters(reorderedStarters);
      setBench(pool.map(p => ({ ...p, slot: undefined, isBench: true })));
    } else {
      setStarters(newStarters);
      setBench(newBench);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRoster, savedLineup]);

  // Inject projected points once projections load (or when they update)
  useEffect(() => {
    if (!projections || Object.keys(projections).length === 0) return;
    setStarters(prev => prev.map(p => ({
      ...p,
      proj: getProjectedPoints(projections, p.name, p.pos, p.nflTeam),
    })));
    setBench(prev => prev.map(p => ({
      ...p,
      proj: getProjectedPoints(projections, p.name, p.pos, p.nflTeam),
    })));
  }, [projections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject live in-game scores once polling data arrives
  useEffect(() => {
    if (!liveScores || Object.keys(liveScores).length === 0) return;
    const applyLive = (players: Player[]) => players.map(p => {
      const live = getLivePoints(liveScores, p.name, p.pos, p.nflTeam, kickerEvents);
      return live !== null ? { ...p, pts: live } : p;
    });
    setStarters(prev => applyLive(prev));
    setBench(prev => applyLive(prev));
  }, [liveScores, kickerEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [optimized, setOptimized] = useState(false);

  // Per-player locking: a player is locked once their NFL game has kicked off
  // The global lineupLocked flag is true only when ALL starters are locked
  const lineupLocked = starters.length > 0 && starters.every(p => isPlayerLocked(p.nflTeam, matchupMap));

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

  const handleTableSelect = (player: Player) => {
    if (isReadOnly) return;
    const locked = isPlayerLocked(player.nflTeam, matchupMap);
    if (locked) return;
    const playerKey = lineupPlayerKey(player.name);
    setSelectedId(current => current === playerKey ? null : playerKey);
  };

  const selectedStarter = starters.find(player => lineupPlayerKey(player.name) === selectedId);
  const selectedBench = bench.find(player => lineupPlayerKey(player.name) === selectedId);
  const sflexPlayers = [...starters, ...bench].filter(player => ["QB", "RB", "WR", "TE"].includes(player.pos));
  const kickerPlayers = [...starters, ...bench].filter(player => player.pos === "K");
  const defensePlayers = [...starters, ...bench].filter(player => player.pos === "DST");
  const getInlineSwapChoices = (player: Player) => player.isBench
    ? starters.filter(starter => getEligibleSlots(player).some(slot => slot.slot === starter.slot) && !isPlayerLocked(starter.nflTeam, matchupMap))
    : getEligibleBench(player.slot ?? "").filter(candidate => !isPlayerLocked(candidate.nflTeam, matchupMap));
  const performInlineSwap = (source: Player, candidate: Player) => {
    if (source.isBench) doSwap(candidate.id, source.id);
    else doSwap(source.id, candidate.id);
  };

  const handleSave = async () => {
    // Build rows for all starters and bench players
    const rows = [
      ...starters.map((p, i) => ({
        slot: p.slot ?? `STARTER_${i}`,
        player_id: p.id,
        player_name: p.name,
        is_bench: false,
      })),
      ...bench.map((p, i) => ({
        slot: `BENCH_${i}`,
        player_id: p.id,
        player_name: p.name,
        is_bench: true,
      })),
    ];
    console.log("[Lineup] handleSave — ownerTeamId:", ownerTeamId, "starters:", starters.length, "bench:", bench.length);
    const ok = await saveLineup(rows);
    if (ok) {
      toast.success("Lineup saved!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      toast.error("Failed to save lineup — please try again");
    }
  };

  return (
    <div className="bg-stadium-dawn bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ width: "100%", maxWidth: 1360, margin: "0 auto", padding: "1.5rem clamp(0.35rem, 1.2vw, 1.5rem) 3rem" }}>

        {/* ── Back link (read-only mode) ── */}
        {/* ── Team Selector Dropdown ── */}
        <div style={{ marginBottom: "1rem" }}>
          <select
            value={teamId ?? (franchise?.id ?? "")}
            onChange={e => {
              const val = e.target.value;
              if (!val) return;
              if (val === franchise?.id) {
                navigate("/lineup");
              } else {
                navigate(`/lineup/${val}`);
              }
            }}
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(0,0,0,0.45)",
              color: "oklch(0.78 0.15 85)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "0.45rem 0.9rem",
              cursor: "pointer",
              appearance: "none" as const,
              WebkitAppearance: "none" as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c9a227' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.6rem center",
              paddingRight: "2rem",
            }}
          >
            {Object.entries(TEAM_ID_TO_NAME).map(([id, name]) => (
              <option key={id} value={id} style={{ background: "#1a2e1a", color: "white" }}>
                {name}{id === franchise?.id ? " (My Team)" : ""}
              </option>
            ))}
          </select>
          {isReadOnly && (
            <span style={{ marginLeft: "0.75rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.04em" }}>
              READ ONLY
            </span>
          )}
        </div>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {isReadOnly && <Eye size={18} style={{ opacity: 0.6 }} />}
              {(isReadOnly ? viewTeamName : franchise?.team_name) && (
                <TeamLogo teamName={(isReadOnly ? viewTeamName : franchise?.team_name) ?? ""} size={36} style={{ borderRadius: 6 }} />
              )}
              {isReadOnly ? viewTeamName : "My Lineup"}
            </h1>
            <p>{isReadOnly ? "Read-only view" : (franchise?.team_name || "Select a team")} — Week {currentWeek} · Lock: players lock at kickoff</p>
          </div>
          {/* Controls — only shown to the owner of this lineup */}
          {!isReadOnly && (
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
                <button onClick={handleSave} disabled={saving} style={{
                  background: saved ? "oklch(0.42 0.15 150)" : saving ? "oklch(0.4 0.06 150)" : "oklch(0.28 0.09 150)",
                  color: "white", border: "none", borderRadius: 8,
                  padding: "0.5rem 1.25rem",
                  fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase" as const,
                  cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
                  transition: "background 0.2s",
                  opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? "Saving..." : saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Lineup"}
                </button>
              )}
            </div>
          )}
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
          {leagueMedian !== null && (
            <div>
              <div style={{ fontSize: "0.62rem", color: "oklch(0.75 0.06 150)", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Lg Median</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "1.4rem", fontWeight: 700, lineHeight: 1, color: totalPts >= leagueMedian ? "oklch(0.72 0.18 150)" : "oklch(0.72 0.18 25)" }}>
                {leagueMedian.toFixed(1)}
              </div>
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isPolling && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "oklch(0.35 0.15 150 / 0.6)", borderRadius: 5, padding: "2px 7px" }}>
                <Wifi size={10} color="oklch(0.78 0.15 85)" />
                <span style={{ fontSize: "0.6rem", color: "oklch(0.78 0.15 85)", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
                {lastUpdated && <span style={{ fontSize: "0.58rem", color: "oklch(0.65 0.06 150)" }}>{lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            )}
            <span style={{ fontSize: "0.72rem", color: "oklch(0.75 0.06 150)" }}>
              {lineupLocked ? "All starters locked — games in progress" : "Players lock at kickoff · ⚡ Best Lineup auto-optimizes"}
            </span>
          </div>
        </div>

        {/* ── POSITION-SPECIFIC LINEUP PANELS ── */}
        <LineupRosterTable
          title={`SFLEX · ${sflexPlayers.length} players · ${totalPts.toFixed(1)} pts · Proj ${totalProj.toFixed(1)}`}
          profile="SFLEX"
          players={sflexPlayers}
          statMap={lineupStatMap}
          metaMap={lineupMetaMap}
          matchupMap={matchupMap}
          injuries={injuries}
          selectedId={selectedId}
          isReadOnly={isReadOnly}
          onSelect={handleTableSelect}
          onPlayerClick={(player) => navigate(`/player/${encodeURIComponent(player.name)}`)}
          getInlineChoices={getInlineSwapChoices}
          onInlineSwap={performInlineSwap}
        />
        <LineupRosterTable
          title={`K · ${kickerPlayers.length} player${kickerPlayers.length === 1 ? "" : "s"}`}
          profile="K"
          players={kickerPlayers}
          statMap={lineupStatMap}
          metaMap={lineupMetaMap}
          matchupMap={matchupMap}
          injuries={injuries}
          selectedId={selectedId}
          isReadOnly={isReadOnly}
          onSelect={handleTableSelect}
          onPlayerClick={(player) => navigate(`/player/${encodeURIComponent(player.name)}`)}
          getInlineChoices={getInlineSwapChoices}
          onInlineSwap={performInlineSwap}
        />
        <LineupRosterTable
          title={`D/ST · ${defensePlayers.length} player${defensePlayers.length === 1 ? "" : "s"}`}
          profile="DST"
          players={defensePlayers}
          statMap={lineupStatMap}
          metaMap={lineupMetaMap}
          matchupMap={matchupMap}
          injuries={injuries}
          selectedId={selectedId}
          isReadOnly={isReadOnly}
          onSelect={handleTableSelect}
          onPlayerClick={(player) => navigate(`/player/${encodeURIComponent(player.name)}`)}
          getInlineChoices={getInlineSwapChoices}
          onInlineSwap={performInlineSwap}
        />

        {!isReadOnly && (selectedStarter || selectedBench) && (
          <section className="wrc-card" style={{ marginBottom: "1rem", display: "none" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header">{selectedStarter ? `Swap ${selectedStarter.name}` : `Start ${selectedBench?.name}`}</div>
            <div style={{ padding: "0.75rem 1rem" }}>
              {selectedStarter ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {getEligibleBench(selectedStarter.slot ?? "").map(player => (
                    <button key={player.id} onClick={() => doSwap(selectedStarter.id, player.id)} style={{ border: "1px solid oklch(0.78 0.1 85)", background: "white", color: "oklch(0.25 0.08 150)", borderRadius: 7, padding: "0.45rem 0.7rem", cursor: "pointer", fontWeight: 700 }}>{player.name} <span style={{ color: "oklch(0.55 0.13 85)" }}>· {player.proj.toFixed(1)} proj</span></button>
                  ))}
                  {getEligibleBench(selectedStarter.slot ?? "").length === 0 && <span style={{ color: "oklch(0.52 0.04 150)", fontSize: "0.8rem" }}>No eligible bench players for this slot.</span>}
                </div>
              ) : selectedBench ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {getEligibleSlots(selectedBench).filter(slot => {
                    const currentStarter = starters.find(player => player.slot === slot.slot);
                    return !currentStarter || !isPlayerLocked(currentStarter.nflTeam, matchupMap);
                  }).map(slot => {
                    const currentStarter = starters.find(player => player.slot === slot.slot);
                    return currentStarter ? <button key={slot.slot} onClick={() => doSwap(currentStarter.id, selectedBench.id)} style={{ border: "1px solid oklch(0.78 0.1 85)", background: "white", color: "oklch(0.25 0.08 150)", borderRadius: 7, padding: "0.45rem 0.7rem", cursor: "pointer", fontWeight: 700 }}>{slot.slot}: {currentStarter.name}</button> : null;
                  })}
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* Legacy row views are retained only as interaction fallback during this table rollout. */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem", display: "none" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Starting Lineup
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.78 0.15 85)" }}>{totalPts.toFixed(1)} pts · Proj {totalProj.toFixed(1)}</span>
          </div>

          {STARTER_SLOTS.map(({ slot, label }) => {
            const player    = starters.find(p => p.slot === slot);
            const isSelected = Boolean(player && selectedId === lineupPlayerKey(player.name));
            const eligibleBench = getEligibleBench(slot);
            // Per-player lock: this starter is locked if their game has started
            const playerLocked = player ? isPlayerLocked(player.nflTeam, matchupMap) : false;

            return (
              <div key={slot}>
                <div
                  onClick={() => { if (!player) return; navigate(`/player/${encodeURIComponent(player.name)}`); }}
                  className={player ? "wrc-row-hover" : ""}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.6rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: player ? "pointer" : "default",
                    background: isSelected ? "oklch(0.94 0.04 150)" : playerLocked ? "oklch(0.97 0.005 0)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  {/* Slot badge — clicking opens swap panel (stopPropagation prevents row nav) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isReadOnly || playerLocked || !player) return;
                      setSelectedId(isSelected ? null : player.id);
                    }}
                    style={{
                      width: 52, textAlign: "center",
                      fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                      letterSpacing: "0.06em", color: "white",
                      background: player ? POS_COLORS[player.pos] || "oklch(0.5 0.04 150)" : "oklch(0.75 0.02 150)",
                      borderRadius: 4, padding: "2px 0", flexShrink: 0,
                      cursor: (!isReadOnly && !playerLocked && player) ? "pointer" : "default",
                      outline: (!isReadOnly && !playerLocked && player) ? "2px solid transparent" : "none",
                      transition: "filter 0.12s",
                      filter: (!isReadOnly && !playerLocked && player) ? undefined : undefined,
                    }}
                    onMouseEnter={(e) => { if (!isReadOnly && !playerLocked && player) (e.currentTarget as HTMLElement).style.filter = "brightness(1.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                    title={(!isReadOnly && !playerLocked && player) ? "Tap to swap" : undefined}
                  >
                    <div>{slot}</div>
                    {(!isReadOnly && !playerLocked && player) && (
                      <div style={{ fontSize: "0.5rem", opacity: 0.75, lineHeight: 1, marginTop: "1px" }}>⇄</div>
                    )}
                  </div>

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
                          <GameInfo nflTeam={player.nflTeam} matchupMap={matchupMap} />
                        </div>
                        {/* Season stats row */}
                        <SeasonStatsRow player={player} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        {(() => {
                          const designation = getInjuryDesignation(injuries, player.name);
                          const injColor = designation ? getInjuryColor(designation) : null;
                          if (injColor) {
                            return (
                              <span style={{
                                fontSize: "0.62rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                                padding: "1px 5px", borderRadius: 3,
                                background: injColor.bg, color: injColor.text, border: `1px solid ${injColor.border}`,
                              }} title={designation}>{getInjuryLabel(designation)}</span>
                            );
                          }
                          return null;
                        })()}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                          <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                        </div>
                        {!isReadOnly && (
                          playerLocked
                            ? <Lock size={12} color="oklch(0.55 0.04 0)" style={{ opacity: 0.5 }} />
                            : isSelected
                              ? <X size={14} color="oklch(0.5 0.04 150)" onClick={(e) => { e.stopPropagation(); setSelectedId(null); }} style={{ cursor: "pointer" }} />
                              : null
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, color: "oklch(0.7 0.02 150)", fontSize: "0.85rem", fontStyle: "italic" }}>Empty — {label}</div>
                  )}
                </div>

                {/* Inline swap panel — starter selected */}
                {isSelected && !isReadOnly && !playerLocked && (
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
                                <GameInfo nflTeam={bp.nflTeam} matchupMap={matchupMap} />
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
        <div className="wrc-card" style={{ display: "none" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">
            Bench
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.6 0.04 150)" }}>{bench.length} players</span>
          </div>

          {bench.map((player) => {
            const isSelected    = selectedId === lineupPlayerKey(player.name);
            // For bench: eligible slots that are NOT yet locked (starter's game hasn't started)
            const eligibleSlots = getEligibleSlots(player).filter(slotDef => {
              const currentStarter = starters.find(s => s.slot === slotDef.slot);
              return !currentStarter || !isPlayerLocked(currentStarter.nflTeam, matchupMap);
            });
            // Bench player is clickable if at least one eligible unlocked slot exists
            const benchCanSwap = !isReadOnly && eligibleSlots.length > 0;

            return (
              <div key={player.id}>
                <div
                  onClick={() => navigate(`/player/${encodeURIComponent(player.name)}`)}
                  className="wrc-row-hover"
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.6rem 1rem",
                    borderBottom: isSelected ? "none" : "1px solid oklch(0.93 0.005 150)",
                    cursor: "pointer",
                    background: isSelected ? "oklch(0.94 0.04 150)" : "white",
                    transition: "background 0.12s",
                  }}
                >
                  {/* Position badge — clicking opens swap panel */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!benchCanSwap) return;
                      setSelectedId(isSelected ? null : player.id);
                    }}
                    style={{
                      width: 52, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.68rem", fontWeight: 700,
                      letterSpacing: "0.06em", color: "white", background: POS_COLORS[player.pos] || "oklch(0.5 0.04 150)",
                      borderRadius: 4, padding: "2px 0", flexShrink: 0,
                      cursor: benchCanSwap ? "pointer" : "default",
                      transition: "filter 0.12s",
                    }}
                    onMouseEnter={(e) => { if (benchCanSwap) (e.currentTarget as HTMLElement).style.filter = "brightness(1.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                    title={benchCanSwap ? "Tap to swap" : undefined}
                  >
                    <div>{player.pos}</div>
                    {benchCanSwap && (
                      <div style={{ fontSize: "0.5rem", opacity: 0.75, lineHeight: 1, marginTop: "1px" }}>⇄</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {player.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px", flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: "0.68rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</span>
                      <GameInfo nflTeam={player.nflTeam} matchupMap={matchupMap} />
                    </div>
                    {/* Season stats row */}
                    <SeasonStatsRow player={player} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    {(() => {
                      const designation = getInjuryDesignation(injuries, player.name);
                      const injColor = designation ? getInjuryColor(designation) : null;
                      if (injColor) {
                        return (
                          <span style={{
                            fontSize: "0.62rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif",
                            padding: "1px 5px", borderRadius: 3,
                            background: injColor.bg, color: injColor.text, border: `1px solid ${injColor.border}`,
                          }} title={designation}>{getInjuryLabel(designation)}</span>
                        );
                      }
                      return null;
                    })()}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                      <div style={{ fontSize: "0.62rem", color: "oklch(0.6 0.04 150)" }}>Proj {player.proj.toFixed(1)}</div>
                    </div>
                    {benchCanSwap && isSelected && (
                      <X size={14} color="oklch(0.5 0.04 150)" onClick={(e) => { e.stopPropagation(); setSelectedId(null); }} style={{ cursor: "pointer" }} />
                    )}
                  </div>
                </div>

                {/* Inline swap panel — bench player selected */}
                {isSelected && benchCanSwap && (
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
