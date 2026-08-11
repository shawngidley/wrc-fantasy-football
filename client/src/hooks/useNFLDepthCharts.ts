/**
 * useNFLDepthCharts — fetches depth chart data from Tank01 getNFLDepthCharts endpoint
 * Builds a map of playerName → depthPosition (e.g. "RB1", "WR2")
 * Cached 1 hour in sessionStorage.
 */
import { useState, useEffect } from "react";

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const CACHE_KEY = "wrc_nfl_depth_charts_v1";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// All 32 NFL team abbreviations
const NFL_TEAMS = [
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE",
  "DAL","DEN","DET","GB","HOU","IND","JAC","KC",
  "LAC","LAR","LV","MIA","MIN","NE","NO","NYG",
  "NYJ","PHI","PIT","SEA","SF","TB","TEN","WSH",
];

export interface DepthEntry {
  depthPosition: string; // e.g. "RB1", "WR2"
  playerID: string;
  longName: string;
}

// Map: playerName (lowercase) → { depthPosition, nflTeam }
export type DepthChartMap = Map<string, { depthPosition: string; nflTeam: string }>;

async function fetchDepthForTeam(teamAbv: string): Promise<{ team: string; positions: Record<string, DepthEntry[]> }> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/getNFLDepthCharts?teamAbv=${teamAbv}`,
    {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    }
  );
  const json = await res.json();
  const body = Array.isArray(json.body) ? json.body : [];
  const depthChart = body[0]?.depthChart ?? {};
  return { team: teamAbv, positions: depthChart };
}

export function useNFLDepthCharts(): { depthMap: DepthChartMap; loading: boolean } {
  const [depthMap, setDepthMap] = useState<DepthChartMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setDepthMap(new Map(data));
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fetch all teams in parallel (batches of 8 to avoid rate limits)
    const fetchAll = async () => {
      const map = new Map<string, { depthPosition: string; nflTeam: string }>();
      const batches: string[][] = [];
      for (let i = 0; i < NFL_TEAMS.length; i += 8) {
        batches.push(NFL_TEAMS.slice(i, i + 8));
      }
      for (const batch of batches) {
        const results = await Promise.allSettled(batch.map(t => fetchDepthForTeam(t)));
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const { team, positions } = r.value;
          for (const [_pos, entries] of Object.entries(positions)) {
            for (const entry of entries as DepthEntry[]) {
              map.set(entry.longName.toLowerCase(), {
                depthPosition: entry.depthPosition,
                nflTeam: team,
              });
            }
          }
        }
        // Small delay between batches to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: Array.from(map.entries()) }));
      } catch {}
      setDepthMap(map);
      setLoading(false);
    };

    fetchAll();
  }, []);

  return { depthMap, loading };
}

// Lightweight single-team fetch for player card
export async function fetchTeamDepthChart(teamAbv: string): Promise<Record<string, DepthEntry[]>> {
  try {
    const result = await fetchDepthForTeam(teamAbv);
    return result.positions;
  } catch {
    return {};
  }
}
