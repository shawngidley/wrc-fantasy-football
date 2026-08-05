/**
 * useNFLGameLog — fetches per-game stats for a player from Tank01.
 * Uses getNFLGamesForPlayer endpoint.
 * Caches in sessionStorage for 30 minutes (stats may update during season).
 */
import { useState, useEffect } from "react";
import { calcFantasyPoints } from "@/lib/scoringEngine";

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;
const HEADERS = {
  "x-rapidapi-host": RAPIDAPI_HOST,
  "x-rapidapi-key": RAPIDAPI_KEY,
};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface GameLogEntry {
  gameID: string;
  gameDate: string;     // "20260913"
  opponent: string;     // "HOU"
  isHome: boolean;
  team: string;
  result?: string;      // "W 34-10" | "L 17-21" | undefined (future)
  // Passing
  passYds?: number;
  passTD?: number;
  passInt?: number;
  passCmp?: number;
  passAtt?: number;
  passRating?: number;
  // Rushing
  rushYds?: number;
  rushTD?: number;
  rushAtt?: number;
  // Receiving
  rec?: number;
  recYds?: number;
  recTD?: number;
  targets?: number;
  // Kicking
  fgMade?: number;
  fgAtt?: number;
  xpMade?: number;
  xpAtt?: number;
  // Defense
  sacks?: number;
  defInt?: number;
  defTD?: number;
  fumblesRecovered?: number;
  // WRC pts
  wrcPts: number;
}

function n(v: string | number | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const p = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(p) ? 0 : p;
}

function parseGameEntry(gameID: string, raw: Record<string, unknown>, pos: string): GameLogEntry {
  // gameID format: "20260913_BUF@HOU" — away@home
  const parts = gameID.split("_");
  const dateStr = parts[0] ?? "";
  const matchup = parts[1] ?? "";
  const [awayTeam, homeTeam] = matchup.split("@");
  const team = (raw.teamAbv as string) ?? (raw.team as string) ?? "";
  const isHome = team === homeTeam;
  const opponent = isHome ? awayTeam : homeTeam;

  const passing = (raw.Passing as Record<string, string>) ?? {};
  const rushing = (raw.Rushing as Record<string, string>) ?? {};
  const receiving = (raw.Receiving as Record<string, string>) ?? {};
  const kicking = (raw.Kicking as Record<string, string>) ?? {};
  const defense = (raw.Defense as Record<string, string>) ?? {};

  // Build result string from score if available
  let result: string | undefined;
  if (raw.gameResult) {
    result = raw.gameResult as string;
  } else if (raw.homePts !== undefined && raw.awayPts !== undefined) {
    const homePts = n(raw.homePts as string);
    const awayPts = n(raw.awayPts as string);
    const myPts = isHome ? homePts : awayPts;
    const oppPts = isHome ? awayPts : homePts;
    const win = myPts > oppPts ? "W" : myPts < oppPts ? "L" : "T";
    result = `${win} ${myPts}-${oppPts}`;
  }

  const entry: GameLogEntry = {
    gameID,
    gameDate: dateStr,
    opponent,
    isHome,
    team,
    result,
    passYds:   n(passing.passYds),
    passTD:    n(passing.passTD),
    passInt:   n(passing.int),
    passCmp:   n(passing.passCompletions),
    passAtt:   n(passing.passAttempts),
    passRating: n(passing.rtg),
    rushYds:   n(rushing.rushYds),
    rushTD:    n(rushing.rushTD),
    rushAtt:   n(rushing.carries),
    rec:       n(receiving.receptions),
    recYds:    n(receiving.recYds),
    recTD:     n(receiving.recTD),
    targets:   n(receiving.targets),
    fgMade:    n(kicking.fgMade),
    fgAtt:     n(kicking.fgAttempts),
    xpMade:    n(kicking.xpMade),
    xpAtt:     n(kicking.xpAttempts),
    sacks:     n(defense.sacks),
    defInt:    n(defense.defensiveInterceptions),
    defTD:     n(defense.defTD),
    fumblesRecovered: n(defense.fumblesRecovered),
    wrcPts: 0,
  };

  // Calculate WRC pts for this game
  const tank01Stats = {
    Passing: {
      passYds: entry.passYds, passTD: entry.passTD, int: entry.passInt,
      passCompletions: entry.passCmp, passAttempts: entry.passAtt,
    },
    Rushing: { rushYds: entry.rushYds, rushTD: entry.rushTD, carries: entry.rushAtt },
    Receiving: { receptions: entry.rec, recYds: entry.recYds, recTD: entry.recTD, targets: entry.targets },
    Kicking: { fgMade: entry.fgMade, fgAttempts: entry.fgAtt, xpMade: entry.xpMade, xpAttempts: entry.xpAtt },
    Defense: {
      sacks: entry.sacks, defensiveInterceptions: entry.defInt,
      fumblesRecovered: entry.fumblesRecovered, defTD: entry.defTD,
    },
  };
  entry.wrcPts = calcFantasyPoints(tank01Stats, pos);

  return entry;
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data as T;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function useNFLGameLog(
  playerID: string | null | undefined,
  pos: string,
  season = 2026
) {
  const [games, setGames] = useState<GameLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerID) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const cacheKey = `wrc_gamelog_${playerID}_${season}_${pos}`;
    const cached = cacheGet<GameLogEntry[]>(cacheKey);
    if (cached) {
      setGames(cached);
      setLoading(false);
      return;
    }

    fetch(
      `${BASE_URL}/getNFLGamesForPlayer?playerID=${playerID}&season=${season}`,
      { headers: HEADERS }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const body = data?.body ?? {};
        const entries: GameLogEntry[] = Object.entries(body as Record<string, unknown>)
          .filter(([gameID]) => {
            // Only include regular season games (gameID starts with the season year)
            // Preseason games have dates in Aug, regular season Sep+
            const dateStr = gameID.split("_")[0] ?? "";
            const month = parseInt(dateStr.slice(4, 6), 10);
            return month >= 9; // Sep onwards = regular season
          })
          .map(([gameID, raw]) => parseGameEntry(gameID, raw as Record<string, unknown>, pos))
          .sort((a, b) => a.gameDate.localeCompare(b.gameDate));

        cacheSet(cacheKey, entries);
        setGames(entries);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load game log");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [playerID, pos, season]);

  return { games, loading, error };
}
