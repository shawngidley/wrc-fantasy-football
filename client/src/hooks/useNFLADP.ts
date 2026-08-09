/**
 * useNFLADP — fetches live PPR ADP from Tank01 getNFLADP endpoint
 * Returns a map of player name (lowercase) → overall ADP number
 * Cached in sessionStorage for 1 hour to avoid excessive API calls
 */
import { useState, useEffect } from "react";

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const CACHE_KEY = "wrc_nfl_adp_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type ADPMap = Map<string, number>;

export function useNFLADP() {
  const [adpMap, setAdpMap] = useState<ADPMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setAdpMap(new Map(data));
          setLoading(false);
          return;
        }
      }
    } catch {}

    fetch(`https://${RAPIDAPI_HOST}/getNFLADP?adpType=PPR`, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    })
      .then(r => r.json())
      .then(json => {
        const body = json?.body ?? {};
        const entries = Array.isArray(body) ? body : Object.values(body);
        const map = new Map<string, number>();
        for (const p of entries as Array<{ longName?: string; overallADP?: string }>) {
          if (p.longName && p.overallADP) {
            map.set(p.longName.toLowerCase(), parseFloat(p.overallADP));
          }
        }
        setAdpMap(map);
        // Cache for 1 hour
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: Array.from(map.entries()), ts: Date.now() }));
        } catch {}
      })
      .catch(err => console.warn("[ADP] fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  return { adpMap, loading };
}
