/**
 * WRC Free Agents stats loader.
 * Style: fetch only visible rows, cache each Tank01 season line in sessionStorage,
 * and limit concurrency to protect the API and keep the browser responsive.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchNFLTeams, fetchPlayerByName } from "@/hooks/useTank01Player";
import { normalizeNFLTeamCode } from "@/lib/nflTeamCodes";
import { normalizeTankSeasonStats, normalizeTankTeamSeasonStats, type PlayerSeasonStats } from "@/lib/playerSeasonStats";

export interface SeasonStatsPlayerInput {
  name: string;
  pos: string;
  nflTeam?: string;
}

const CACHE_PREFIX = "wrc_tank01_season_stats_v5_";
const CACHE_TTL_MS = 30 * 60 * 1000;
const CONCURRENCY = 4;

function cacheKey(name: string) {
  return `${CACHE_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

interface SeasonStatsCacheEntry {
  stats: PlayerSeasonStats;
  age?: string;
  headshot?: string;
}

function cacheGet(name: string): SeasonStatsCacheEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: SeasonStatsCacheEntry };
    return Date.now() - parsed.ts < CACHE_TTL_MS ? parsed.data : null;
  } catch {
    return null;
  }
}

function cacheSet(name: string, data: SeasonStatsCacheEntry) {
  try {
    sessionStorage.setItem(cacheKey(name), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Cache is an enhancement only; the table still works without it.
  }
}

export function useNFLSeasonStats(players: SeasonStatsPlayerInput[], enabled: boolean) {
  const [statMap, setStatMap] = useState<Record<string, PlayerSeasonStats>>({});
  const [playerMetaMap, setPlayerMetaMap] = useState<Record<string, { age?: string; headshot?: string }>>({});
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
    const nextMeta: Record<string, { age?: string; headshot?: string }> = {};
    const uncached = players.filter((player) => {
      const cached = cacheGet(player.name);
      if (cached) {
        next[player.name.toLowerCase()] = cached.stats;
        nextMeta[player.name.toLowerCase()] = { age: cached.age, headshot: cached.headshot };
      }
      return !cached;
    });

    setStatMap(next);
    setPlayerMetaMap(nextMeta);
    setLoadedCount(Object.keys(next).length);
    setLoading(uncached.length > 0);
    const dstPlayers = uncached.filter(player => player.pos === "DST" && player.nflTeam);
    const individualPlayers = uncached.filter(player => player.pos !== "DST" || !player.nflTeam);

    async function loadDstStats() {
      if (!dstPlayers.length) return;
      const teams = await fetchNFLTeams(true);
      if (cancelled) return;
      for (const player of dstPlayers) {
        const team = teams.find(candidate => normalizeNFLTeamCode(candidate.teamAbv) === normalizeNFLTeamCode(player.nflTeam ?? ""));
        if (!team) continue;
        const stats = normalizeTankTeamSeasonStats(team);
        cacheSet(player.name, { stats });
        next[player.name.toLowerCase()] = stats;
        setStatMap({ ...next });
        setLoadedCount(Object.keys(next).length);
      }
    }

    async function worker() {
      while (!cancelled && individualPlayers.length) {
        const player = individualPlayers.shift();
        if (!player) return;
        const tankPlayer = await fetchPlayerByName(player.name);
        if (cancelled) return;
        const stats = normalizeTankSeasonStats(tankPlayer?.stats, player.pos);
        const meta = { age: tankPlayer?.age, headshot: tankPlayer?.espnHeadshot };
        cacheSet(player.name, { stats, ...meta });
        next[player.name.toLowerCase()] = stats;
        nextMeta[player.name.toLowerCase()] = meta;
        setStatMap({ ...next });
        setPlayerMetaMap({ ...nextMeta });
        setLoadedCount(Object.keys(next).length);
      }
    }

    void Promise.all([
      loadDstStats(),
      ...Array.from({ length: Math.min(CONCURRENCY, individualPlayers.length) }, () => worker()),
    ])
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [requestKey, enabled]);

  return { statMap, playerMetaMap, loading, loadedCount };
}
