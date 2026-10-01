/**
 * useNFLTeamSchedule — fetches the full 2026 NFL team schedule from Tank01.
 * Uses getNFLTeamSchedule endpoint.
 * Caches in sessionStorage for 6 hours.
 */
import { useState, useEffect } from "react";
import { normalizeNFLTeamCode } from "@shared/nflTeamCodes";

const BASE_URL = "/api/tank01";
const HEADERS = {};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// getNFLTeamSchedule's teamAbv matches the app's team codes for every team
// except Jacksonville: the app stores it as "JAC" (it normalizes Tank01's "JAX"
// to "JAC" everywhere), but the schedule endpoint only knows "JAX", so convert
// it back for the request. Confirmed against getNFLTeams: KC, TB, ARI and WSH
// are identical in both. (KAN/TAM/ARZ/WAS are Tank01's response-only codes and
// are NOT valid teamAbv values -- mapping to them returns an empty schedule.)
const APP_TO_TANK01_TEAM: Record<string, string> = {
  JAC: "JAX",
};

export interface ScheduleGame {
  gameID: string;
  week: string;         // "Week 1", "Week 2", ...
  weekNum: number;      // 1-18
  gameDate: string;     // "20260913"
  gameTime: string;     // "1:00p"
  home: string;         // "BUF"
  away: string;         // "HOU"
  gameStatus: string;   // "Scheduled" | "Final" | "In Progress"
  homeScore?: string;
  awayScore?: string;
  isHome: boolean;      // relative to the queried team
  opponent: string;     // the other team
  seasonType: string;   // "Regular Season" | "Preseason"
}

function parseDate(dateStr: string): string {
  // "20260913" → "Sep 13"
  const year = dateStr.slice(0, 4);
  const month = parseInt(dateStr.slice(4, 6), 10);
  const day = parseInt(dateStr.slice(6, 8), 10);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[month - 1]} ${day}`;
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

export async function fetchTeamSchedule(teamAbv: string, season = 2026): Promise<ScheduleGame[]> {
  const appTeam = teamAbv.toUpperCase();
  const tankTeam = APP_TO_TANK01_TEAM[appTeam] ?? appTeam;
  // v2: the v1 key cached empty results from the earlier wrong team-code mapping;
  // bumping the version discards those so the corrected request is used.
  const cacheKey = `wrc_schedule_v2_${appTeam}_${season}`;
  const cached = cacheGet<ScheduleGame[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `${BASE_URL}/getNFLTeamSchedule?teamAbv=${tankTeam}&season=${season}`,
    { headers: HEADERS }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const raw: Record<string, string>[] = data?.body?.schedule ?? [];

  const games: ScheduleGame[] = raw
    .filter((g) => g.seasonType === "Regular Season")
    .map((g) => {
      const weekMatch = g.gameWeek?.match(/Week (\d+)/);
      const weekNum = weekMatch ? parseInt(weekMatch[1], 10) : 0;
      const homeCode = normalizeNFLTeamCode(g.home);
      const awayCode = normalizeNFLTeamCode(g.away);
      const isHome = homeCode === appTeam;
      const opponent = isHome ? awayCode : homeCode;
      return {
        gameID: g.gameID,
        week: g.gameWeek ?? "",
        weekNum,
        gameDate: g.gameDate ?? "",
        gameTime: g.gameTime ?? "",
        home: homeCode,
        away: awayCode,
        gameStatus: g.gameStatus ?? "Scheduled",
        homeScore: g.homePts,
        awayScore: g.awayPts,
        isHome,
        opponent,
        seasonType: g.seasonType ?? "Regular Season",
      };
    })
    .sort((a, b) => a.weekNum - b.weekNum);

  cacheSet(cacheKey, games);
  return games;
}

export function useNFLTeamSchedule(teamAbv: string | null | undefined, season = 2026) {
  const [schedule, setSchedule] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamAbv) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTeamSchedule(teamAbv, season)
      .then((games) => {
        if (!cancelled) {
          setSchedule(games);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load schedule");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [teamAbv, season]);

  return { schedule, loading, error };
}

export { parseDate };
