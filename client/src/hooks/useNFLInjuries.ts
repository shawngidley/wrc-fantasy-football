/**
 * useNFLInjuries — fetches injury designations for all NFL players
 * using the Tank01 getNFLTeamRoster endpoint.
 *
 * Returns a map of playerName (lowercase) → injury designation string
 * e.g. "Questionable", "Doubtful", "Out", "IR", "PUP", ""
 *
 * Strategy: fetch all 32 NFL teams in parallel, cache in sessionStorage.
 * Refreshes once per day (86400s TTL).
 */
import { useState, useEffect } from "react";

const RAPIDAPI_KEY = import.meta.env.VITE_TANK01_KEY || "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const CACHE_KEY = "wrc_nfl_injuries_v1";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

/** Map of lowercase player name → injury designation */
export type InjuryMap = Record<string, string>;

interface UseNFLInjuriesResult {
  injuries: InjuryMap;
  loading: boolean;
}

// All 32 NFL team abbreviations
const ALL_NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB",  "HOU", "IND", "JAC", "KC",
  "LAC", "LAR", "LV",  "MIA", "MIN", "NE",  "NO",  "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF",  "TB",  "TEN", "WSH",
];

/** Get a color for an injury designation badge */
export function getInjuryColor(designation: string): { bg: string; text: string; border: string } | null {
  const d = designation?.toLowerCase();
  if (!d) return null;
  if (d === "out" || d === "ir" || d === "pup" || d === "dnr") {
    return { bg: "oklch(0.95 0.06 25)", text: "oklch(0.42 0.22 25)", border: "oklch(0.82 0.14 25)" };
  }
  if (d === "doubtful") {
    return { bg: "oklch(0.95 0.06 40)", text: "oklch(0.45 0.2 40)", border: "oklch(0.82 0.12 40)" };
  }
  if (d === "questionable") {
    return { bg: "oklch(0.96 0.06 85)", text: "oklch(0.45 0.18 85)", border: "oklch(0.82 0.12 85)" };
  }
  // Limited, Probable, etc.
  return { bg: "oklch(0.95 0.04 150)", text: "oklch(0.42 0.14 150)", border: "oklch(0.80 0.1 150)" };
}

/** Abbreviated designation label for badges */
export function getInjuryLabel(designation: string): string {
  const d = designation?.toUpperCase();
  if (d === "QUESTIONABLE") return "Q";
  if (d === "DOUBTFUL") return "D";
  if (d === "OUT") return "OUT";
  if (d === "INJURED RESERVE" || d === "IR") return "IR";
  if (d === "PUP") return "PUP";
  if (d === "DNR") return "DNR";
  return d;
}

export function useNFLInjuries(): UseNFLInjuriesResult {
  const [injuries, setInjuries] = useState<InjuryMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check sessionStorage cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          setInjuries(data);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    let cancelled = false;

    async function fetchTeamInjuries(teamAbv: string): Promise<[string, string][]> {
      try {
        const url = `https://${RAPIDAPI_HOST}/getNFLTeamRoster?teamAbv=${teamAbv}`;
        const res = await fetch(url, {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const roster: Array<Record<string, unknown>> = data?.body?.roster ?? [];
        const results: [string, string][] = [];
        for (const player of roster) {
          const name = (player.longName as string) ?? "";
          const inj = (player.injury as Record<string, string>) ?? {};
          const designation = inj.designation ?? "";
          if (name && designation) {
            results.push([name.toLowerCase(), designation]);
          }
        }
        return results;
      } catch {
        return [];
      }
    }

    async function fetchAll() {
      try {
        setLoading(true);
        // Fetch all teams in parallel batches of 8 to avoid rate limiting
        const map: InjuryMap = {};
        const batchSize = 8;
        for (let i = 0; i < ALL_NFL_TEAMS.length; i += batchSize) {
          if (cancelled) return;
          const batch = ALL_NFL_TEAMS.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(fetchTeamInjuries));
          for (const entries of results) {
            for (const [name, designation] of entries) {
              map[name] = designation;
            }
          }
          // Small delay between batches to be polite to the API
          if (i + batchSize < ALL_NFL_TEAMS.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
        if (!cancelled) {
          setInjuries(map);
          // Cache with timestamp
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: map, timestamp: Date.now() }));
          } catch { /* ignore */ }
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  return { injuries, loading };
}

/**
 * Look up a player's injury designation.
 * Returns empty string if no injury.
 */
export function getInjuryDesignation(injuries: InjuryMap, playerName: string): string {
  return injuries[playerName.toLowerCase()] ?? "";
}
