/**
 * useNFLADP — fetches live PPR ADP from Tank01 getNFLADP endpoint
 * Returns a map of player name (lowercase) → overall ADP number
 * Cached in sessionStorage for 1 hour to avoid excessive API calls
 */
import { useState, useEffect } from "react";

const TANK01_BASE_URL = "/api/tank01";
const CACHE_KEY = "wrc_nfl_adp_cache_v3";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type ADPMap = Map<string, number>;

export function useNFLADP() {
  const [adpMap, setAdpMap] = useState<ADPMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache first
    try {
      // Clear old cache keys
      sessionStorage.removeItem("wrc_nfl_adp_cache");
      sessionStorage.removeItem("wrc_nfl_adp_cache_v2");
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

    fetch(`${TANK01_BASE_URL}/getNFLADP?adpType=PPR`)
      .then(r => r.json())
      .then(json => {
        // Tank01 response: { body: { adpDate, adpType, adpList: [...] } }
        const adpList = json?.body?.adpList ?? [];
        const entries = Array.isArray(adpList) ? adpList : [];
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
