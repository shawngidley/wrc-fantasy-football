/**
 * useNFLADP — fetches live PPR ADP from Tank01 getNFLADP endpoint
 * Returns a map of player name (lowercase) → overall ADP number
 * Only accepts payloads explicitly dated in the 2026 season and caches them for one hour.
 */
import { useState, useEffect } from "react";

const TANK01_BASE_URL = "/api/tank01";
const CACHE_KEY = "wrc_nfl_adp_cache_v4";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type ADPMap = Map<string, number>;

export function isCurrent2026AdpDate(value: unknown): value is string {
  return typeof value === "string" && /^2026\d{4}$/.test(value);
}

export function useNFLADP() {
  const [adpMap, setAdpMap] = useState<ADPMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [adpDate, setAdpDate] = useState<string | null>(null);

  useEffect(() => {
    // Check cache first
    try {
      // Clear old cache keys
      sessionStorage.removeItem("wrc_nfl_adp_cache");
      sessionStorage.removeItem("wrc_nfl_adp_cache_v2");
      sessionStorage.removeItem("wrc_nfl_adp_cache_v3");
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts, adpDate: cachedAdpDate } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && isCurrent2026AdpDate(cachedAdpDate)) {
          setAdpMap(new Map(data));
          setAdpDate(cachedAdpDate);
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
        const responseAdpDate = json?.body?.adpDate;
        if (!isCurrent2026AdpDate(responseAdpDate)) {
          throw new Error("Tank01 ADP response did not identify a 2026 ADP date");
        }
        const entries = Array.isArray(adpList) ? adpList : [];
        const map = new Map<string, number>();
        for (const p of entries as Array<{ longName?: string; overallADP?: string }>) {
          if (p.longName && p.overallADP) {
            map.set(p.longName.toLowerCase(), parseFloat(p.overallADP));
          }
        }
        setAdpMap(map);
        setAdpDate(responseAdpDate);
        // Cache for 1 hour
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: Array.from(map.entries()), ts: Date.now(), adpDate: responseAdpDate }));
        } catch {}
      })
      .catch(err => console.warn("[ADP] fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  return { adpMap, loading, adpDate };
}
