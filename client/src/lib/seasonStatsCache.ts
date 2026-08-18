import type { PlayerSeasonStats } from "@/lib/playerSeasonStats";

export const SEASON_STATS_CACHE_PREFIX = "wrc_season_stats_2025_v11_";
export const SEASON_STATS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SeasonStatsCacheEntry {
  stats: PlayerSeasonStats;
  age?: string;
  headshot?: string;
}

interface TimedCacheEntry {
  ts: number;
  data: SeasonStatsCacheEntry;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function seasonStatsCacheKey(name: string): string {
  return `${SEASON_STATS_CACHE_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

export function readSeasonStatsCache(storage: StorageLike, name: string, now = Date.now()): SeasonStatsCacheEntry | null {
  try {
    const raw = storage.getItem(seasonStatsCacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimedCacheEntry;
    if (!parsed?.data || !Number.isFinite(parsed.ts) || now - parsed.ts >= SEASON_STATS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSeasonStatsCache(storage: StorageLike, name: string, data: SeasonStatsCacheEntry, now = Date.now()): void {
  try {
    storage.setItem(seasonStatsCacheKey(name), JSON.stringify({ ts: now, data } satisfies TimedCacheEntry));
  } catch {
    // Persistent caching is an enhancement only; the stat loader can still fetch normally.
  }
}
