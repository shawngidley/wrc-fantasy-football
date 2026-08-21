/**
 * WRC Fantasy Football — Tank01 Player Data Hook
 * Fetches player info + current season stats from Tank01 NFL API.
 * Caches results in sessionStorage to avoid redundant API calls.
 */
import { useState, useEffect } from "react";
import { normalizeNFLTeamCode } from "@/lib/nflTeamCodes";
import type { Tank01Stats } from "@/lib/scoringEngine";
import { getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";

const BASE_URL = "/api/tank01";
const HEADERS = {};

export interface Tank01Player {
  playerID: string;
  longName: string;
  firstName: string;
  lastName: string;
  pos: string;
  team: string;
  teamID: string;
  jerseyNum: string;
  height: string;
  weight: string;
  age: string;
  exp: string;
  school: string;
  espnHeadshot: string;
  espnLink: string;
  espnID: string;
  isFreeAgent: string;
  injury: {
    designation: string;
    description: string;
    injDate: string;
    injReturnDate: string;
  };
  stats?: Tank01Stats;
}

export interface Tank01TeamInfo {
  teamAbv: string;
  teamID: string;
  teamCity: string;
  teamName: string;
  wins?: string;
  loss?: string;
  tie?: string;
  pa?: string;
  espnLogo1: string;
  nflComLogo1: string;
  byeWeeks: Record<string, string[]>;
  teamStats?: Tank01Stats;
}

// ── Session cache ────────────────────────────────────────────────────────────
function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`tank01_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // 10-minute TTL
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: unknown) {
  try {
    sessionStorage.setItem(`tank01_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage full — ignore
  }
}

function normalizeTankPlayer(player: Tank01Player): Tank01Player {
  return { ...player, team: normalizeNFLTeamCode(player.team) };
}

// ── Fetch player by ESPN playerID ────────────────────────────────────────────
export async function fetchPlayerById(playerID: string): Promise<Tank01Player | null> {
  const cacheKey = `player_${playerID}`;
  const cached = cacheGet<Tank01Player>(cacheKey);
  if (cached) return normalizeTankPlayer(cached);

  try {
    const res = await fetch(
      `${BASE_URL}/getNFLPlayerInfo?playerID=${playerID}&getStats=true`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const player: Tank01Player = json.body;
    if (!player || !player.playerID) return null;
    const normalizedPlayer = normalizeTankPlayer(player);
    cacheSet(cacheKey, normalizedPlayer);
    return normalizedPlayer;
  } catch {
    return null;
  }
}

// ── Fetch player by name ─────────────────────────────────────────────────────
export async function fetchPlayerByName(name: string): Promise<Tank01Player | null> {
  const cacheKey = `name_${name.toLowerCase().replace(/\s+/g, "_")}`;
  const cached = cacheGet<Tank01Player>(cacheKey);
  if (cached) return normalizeTankPlayer(cached);

  try {
    const res = await fetch(
      `${BASE_URL}/getNFLPlayerInfo?playerName=${encodeURIComponent(name)}&getStats=true`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const json = await res.json();
    // getNFLPlayerInfo by name returns an array
    const list: Tank01Player[] = Array.isArray(json.body) ? json.body : [json.body];
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const player = list.find(candidate => (candidate.longName || `${candidate.firstName} ${candidate.lastName}`).toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName) ?? list[0];
    if (!player || !player.playerID) {
      const universePlayer = getDraftUniversePlayerByName(name);
      return universePlayer?.sourcePlayerId ? fetchPlayerById(universePlayer.sourcePlayerId) : null;
    }
    const normalizedPlayer = normalizeTankPlayer(player);
    cacheSet(cacheKey, normalizedPlayer);
    return normalizedPlayer;
  } catch {
    return null;
  }
}

// ── Fetch all NFL teams (for logos, bye weeks) ───────────────────────────────
export async function fetchNFLTeams(includeTeamStats = false): Promise<Tank01TeamInfo[]> {
  const cacheKey = includeTeamStats ? "nfl_teams_with_stats" : "nfl_teams";
  const cached = cacheGet<Tank01TeamInfo[]>(cacheKey);
  if (cached) return cached;

  try {
    const query = includeTeamStats ? "?teamStats=true" : "";
    const res = await fetch(`${BASE_URL}/getNFLTeams${query}`, { headers: HEADERS });
    if (!res.ok) return [];
    const json = await res.json();
    const teams: Tank01TeamInfo[] = (json.body ?? []).map((team: Tank01TeamInfo) => ({
      ...team,
      teamAbv: normalizeNFLTeamCode(team.teamAbv),
    }));
    cacheSet(cacheKey, teams);
    return teams;
  } catch {
    return [];
  }
}

// ── React hook: fetch player by ID ───────────────────────────────────────────
export function useTank01Player(playerID: string | null) {
  const [player, setPlayer] = useState<Tank01Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerID) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlayerById(playerID).then((p) => {
      if (cancelled) return;
      setPlayer(p);
      setLoading(false);
      if (!p) setError("Player not found");
    });
    return () => { cancelled = true; };
  }, [playerID]);

  return { player, loading, error };
}

// ── React hook: fetch player by name ─────────────────────────────────────────
export function useTank01PlayerByName(name: string | null) {
  const [player, setPlayer] = useState<Tank01Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlayerByName(name).then((p) => {
      if (cancelled) return;
      setPlayer(p);
      setLoading(false);
      if (!p) setError("Player not found");
    });
    return () => { cancelled = true; };
  }, [name]);

  return { player, loading, error };
}

// ── React hook: NFL teams ─────────────────────────────────────────────────────
export function useNFLTeams() {
  const [teams, setTeams] = useState<Tank01TeamInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNFLTeams().then((t) => {
      if (cancelled) return;
      setTeams(t);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { teams, loading };
}

// ── Helper: get ESPN team logo URL ───────────────────────────────────────────
export function getTeamLogoUrl(teamAbv: string): string {
  const abv = normalizeNFLTeamCode(teamAbv).toLowerCase();
  // Map common abbreviation differences
  const abvMap: Record<string, string> = {
    wsh: "wsh", was: "wsh", wsn: "wsh",
    lv: "lv", oak: "lv",
    lac: "lac",
    lar: "lar",
    kc: "kc", kan: "kc",
    tb: "tb", tam: "tb",
    no: "no",
    ne: "ne",
    gb: "gb",
    sf: "sf",
    sea: "sea",
    ari: "ari", arZ: "ari", arz: "ari",
    atl: "atl",
    bal: "bal",
    buf: "buf",
    car: "car",
    chi: "chi",
    cin: "cin",
    cle: "cle",
    dal: "dal",
    den: "den",
    det: "det",
    hou: "hou",
    ind: "ind",
    jac: "jac",
    min: "min",
    mia: "mia",
    nyg: "nyg",
    nyj: "nyj",
    phi: "phi",
    pit: "pit",
    ten: "ten",
  };
  const mapped = abvMap[abv] ?? abv;
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${mapped}.png`;
}
