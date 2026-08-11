/**
 * WRC Free Agents stats loader.
 * Style: fetch only visible rows, cache each Tank01 season line in sessionStorage,
 * and limit concurrency to protect the API and keep the browser responsive.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchPlayerByName } from "@/hooks/useTank01Player";
import { normalizeTankSeasonStats, type PlayerSeasonStats } from "@/lib/playerSeasonStats";

export interface SeasonStatsPlayerInput {
  name: string;
  pos: string;
}

const CACHE_PREFIX = "wrc_tank01_season_stats_v1_";
const CACHE_TTL_MS = 30 * 60 * 1000;
const CONCURRENCY = 4;

function cacheKey(name: string) {
  return `${CACHE_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

function cacheGet(name: string): PlayerSeasonStats | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; stats: PlayerSeasonStats };
    return Date.now() - parsed.ts < CACHE_TTL_MS ? parsed.stats : null;
  } catch {
    return null;
  }
}

function cacheSet(name: string, stats: PlayerSeasonStats) {
  try {
    sessionStorage.setItem(cacheKey(name), JSON.stringify({ ts: Date.now(), stats }));
  } catch {
    // Cache is an enhancement only; the table still works without it.
  }
}

export function useNFLSeasonStats(players: SeasonStatsPlayerInput[], enabled: boolean) {
  const [statMap, setStatMap] = useState<Record<string, PlayerSeasonStats>>({});
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const requestKey = useMemo(
    () => players.map(player => `${player.name}:${player.pos}`).join("|") ,
    [players]
  );

  useEffect(() => {
    if (!enabled || !players.length) {
      setLoading(false);
      setLoadedCount(0);
      return;
    }

    let cancelled = false;
    const next: Record<string, PlayerSeasonStats> = {};
    const uncached = players.filter((player) => {
      const cached = cacheGet(player.name);
      if (cached) next[player.name.toLowerCase()] = cached;
      return !cached;
    });

    setStatMap(next);
    setLoadedCount(Object.keys(next).length);
    setLoading(uncached.length > 0);

    async function worker() {
      while (!cancelled && uncached.length) {
        const player = uncached.shift();
        if (!player) return;
        const tankPlayer = await fetchPlayerByName(player.name);
        if (cancelled) return;
        const stats = normalizeTankSeasonStats(tankPlayer?.stats, player.pos);
        cacheSet(player.name, stats);
        next[player.name.toLowerCase()] = stats;
        setStatMap({ ...next });
        setLoadedCount(Object.keys(next).length);
      }
    }

    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, uncached.length) }, () => worker()))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [requestKey, enabled]);

  return { statMap, loading, loadedCount };
}
