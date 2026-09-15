/**
 * WRC Fantasy Football — Tank01 Player Data Hook
 * Fetches player info + current season stats from Tank01 NFL API.
 * Caches results in sessionStorage to avoid redundant API calls.
 */
import { useState, useEffect } from "react";
import { normalizeNFLTeamCode } from "@shared/nflTeamCodes";
import type { Tank01Stats } from "@/lib/scoringEngine";
import { getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";
import { normalizePlayerName } from "@shared/playerNameMatch";

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

// ── Persistent cache ─────────────────────────────────────────────────────────
// localStorage (not sessionStorage): shared across every tab on this
// browser, not scoped to one tab. sessionStorage meant a fresh tab always
// started cold, independently re-fetching every visible player even if
// the exact same players had just been looked up moments earlier in a
// different tab -- confirmed live via a burst of 45+ getNFLPlayerInfo
// calls in under a minute, matching LiveScoring's PlayerAvatar component
// (rendered once per visible player, ~30+ per matchup) all missing an
// effectively-empty, tab-local cache at once on a fresh page load.
//
// 24h TTL (was 10 minutes): basic player info -- name, team, headshot,
// age -- doesn't meaningfully change within a day, matching the same TTL
// already used for season stats in seasonStatsCache.ts. The old 10-minute
// TTL meant even a single long-running tab would re-fetch everyone again
// after a short gap.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "tank01_v2_";
function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data as T;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: unknown) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/** Confirmed directly by Tank01 support: their season stats are
 * intentionally computed only after a game is fully processed as
 * complete on their end (an aggregation/averages endpoint, not a live
 * one) -- a completely empty stats object shortly after a game ends
 * reflects that processing lag, not a permanent gap. Caching that empty
 * result for the full 24-hour TTL would lock it in even once Tank01
 * catches up, so it's excluded from caching entirely; the next fetch
 * simply retries instead. */
function hasRealStats(player: Tank01Player): boolean {
  return Object.keys(player.stats ?? {}).length > 0;
}

// ── Concurrency limiter for getNFLPlayerInfo requests ────────────────────────
// Confirmed live: a full LiveScoring page load mounts 30+ PlayerAvatar
// components at once, each independently calling fetchPlayerByName on
// mount with no shared throttling between them -- whenever that many
// players aren't yet cached (e.g. a browser's first visit of the day,
// before the 24h cache above has anything in it), all 30+ fire their own
// simultaneous network request at once. Also the likely cause of the
// unusually slow (3.3-3.8s, vs ~150ms for other Tank01 endpoints)
// response times observed in that exact burst -- Tank01 may be
// throttling/queuing under the concurrent load rather than rejecting it
// outright. Capping how many of these requests are actually in flight at
// once, and queueing the rest, spreads the same total work out instead
// of spiking it all in the same instant.
const MAX_CONCURRENT_PLAYER_INFO_REQUESTS = 5;
let activePlayerInfoRequests = 0;
const playerInfoWaitQueue: Array<() => void> = [];

export async function acquirePlayerInfoSlot(): Promise<void> {
  if (activePlayerInfoRequests < MAX_CONCURRENT_PLAYER_INFO_REQUESTS) {
    activePlayerInfoRequests++;
    return;
  }
  return new Promise<void>(resolve => playerInfoWaitQueue.push(resolve));
}

export function releasePlayerInfoSlot(): void {
  activePlayerInfoRequests--;
  const next = playerInfoWaitQueue.shift();
  if (next) {
    activePlayerInfoRequests++;
    next();
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

  await acquirePlayerInfoSlot();
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
    if (hasRealStats(normalizedPlayer)) cacheSet(cacheKey, normalizedPlayer);
    return normalizedPlayer;
  } catch {
    return null;
  } finally {
    releasePlayerInfoSlot();
  }
}

// ── Fetch player by name ─────────────────────────────────────────────────────
export async function fetchPlayerByName(rawName: string): Promise<Tank01Player | null> {
  const name = rawName.trim();
  const canonicalName = normalizePlayerName(name) === normalizePlayerName("Kenny Gainwell") ? "Kenny Gainwell" : name;
  const cacheKey = `name_${canonicalName.toLowerCase().replace(/\s+/g, "_")}`;
  const cached = cacheGet<Tank01Player>(cacheKey);
  if (cached) return normalizeTankPlayer(cached);

  let res: Response;
  let json: any;
  await acquirePlayerInfoSlot();
  try {
    res = await fetch(
      `${BASE_URL}/getNFLPlayerInfo?playerName=${encodeURIComponent(canonicalName)}&getStats=true`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  } finally {
    releasePlayerInfoSlot();
  }

  try {
    // getNFLPlayerInfo by name returns an array
    const list: Tank01Player[] = Array.isArray(json.body) ? json.body : [json.body];
    const normalizedName = normalizePlayerName(canonicalName);
    // normalizePlayerName strips generational suffixes (Jr/Sr/II/III/IV/V), so
    // a roster name uploaded as e.g. "James Cook" still matches Tank01
    // returning "James Cook III" for the same person.
    const player = list.find(candidate => normalizePlayerName(candidate.longName || `${candidate.firstName} ${candidate.lastName}`) === normalizedName) ?? list[0];
    if (!player || !player.playerID) {
      const universePlayer = getDraftUniversePlayerByName(canonicalName);
      return universePlayer?.sourcePlayerId ? fetchPlayerById(universePlayer.sourcePlayerId) : null;
    }
    const normalizedPlayer = normalizeTankPlayer(player);
    if (hasRealStats(normalizedPlayer)) cacheSet(cacheKey, normalizedPlayer);
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
