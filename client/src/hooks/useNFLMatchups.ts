/**
 * useNFLMatchups — fetches the NFL schedule for a given week and season,
 * returning a map of teamAbv → { opponent, isHome, gameTime, gameDate }
 *
 * Uses the Tank01 getNFLGamesForWeek endpoint.
 * Results are cached in sessionStorage to avoid repeated API calls.
 */
import { useState, useEffect } from "react";

const TANK01_BASE_URL = "/api/tank01";

export interface NFLMatchup {
  opponent: string;   // e.g. "KC"
  isHome: boolean;    // true = home game (vs.), false = away (@)
  gameTime: string;   // e.g. "1:00p"
  gameDate: string;   // e.g. "20260913"
  gameId: string;
}

/** Map of NFL team abbreviation → their Week N matchup info */
export type NFLMatchupMap = Record<string, NFLMatchup>;

interface UseNFLMatchupsResult {
  matchups: NFLMatchupMap;
  loading: boolean;
  error: string | null;
}

const CACHE_PREFIX = "wrc_nfl_matchups_v2_";

// Normalize Tank01 team abbreviations to match app's internal abbreviations
// Tank01 uses JAX, KAN, TAM, ARZ, WAS — app uses JAC, KC, TB, ARI, WSH
function normTeam(abv: string): string {
  const map: Record<string, string> = {
    JAX: "JAC",
    KAN: "KC",
    TAM: "TB",
    ARZ: "ARI",
    WAS: "WSH",
  };
  return map[abv] ?? abv;
}

export function useNFLMatchups(week: number, season = 2026): UseNFLMatchupsResult {
  const [matchups, setMatchups] = useState<NFLMatchupMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${CACHE_PREFIX}${season}_w${week}`;

    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setMatchups(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {
      // ignore storage errors
    }

    let cancelled = false;

    async function fetchMatchups() {
      try {
        setLoading(true);
        setError(null);

        const url = `${TANK01_BASE_URL}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const games: Array<{
          gameID: string;
          away: string;
          home: string;
          gameTime: string;
          gameDate: string;
        }> = data?.body ?? [];

        // Build bidirectional map: both home and away teams get an entry
        const map: NFLMatchupMap = {};
        for (const g of games) {
          const away = normTeam(g.away);
          const home = normTeam(g.home);
          map[away] = {
            opponent: home,
            isHome: false,
            gameTime: g.gameTime,
            gameDate: g.gameDate,
            gameId: g.gameID,
          };
          map[home] = {
            opponent: away,
            isHome: true,
            gameTime: g.gameTime,
            gameDate: g.gameDate,
            gameId: g.gameID,
          };
        }

        if (!cancelled) {
          setMatchups(map);
          // Cache for the session
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(map));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load schedule");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMatchups();
    return () => { cancelled = true; };
  }, [week, season]);

  return { matchups, loading, error };
}

/**
 * Formats a matchup as a short badge string, e.g. "vs. KC" or "@ DAL"
 */
export function formatMatchup(m: NFLMatchup | undefined): string {
  if (!m) return "BYE";
  return m.isHome ? `vs. ${m.opponent}` : `@ ${m.opponent}`;
}

/**
 * Formats the game time nicely, e.g. "Sun 1:00p ET"
 */
export function formatGameTime(m: NFLMatchup | undefined): string {
  if (!m) return "";
  if (!m.gameDate || m.gameDate.length < 8) return m.gameTime;
  const d = m.gameDate;
  const date = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T12:00:00`);
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const day = dayNames[date.getDay()];
  return `${day} ${m.gameTime} ET`;
}
