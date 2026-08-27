import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { getCompletedOffenseSnapshot } from "./seasonStatsSnapshot";

const CACHE_ID = "completed-offense-2025-id-resolved-v5";
const CACHE_SEASON = 2025;
const CACHE_SOURCE = "nflverse-completed-2025-play-by-play-reconciled-v4";

export async function readOrWarmSharedSeasonStats(): Promise<unknown> {
  const { data: existing, error } = await supabaseAdmin
    .from("wrc_season_stats_cache")
    .select("source, payload")
    .eq("id", CACHE_ID)
    .maybeSingle();
  if (error) throw new Error(`Unable to read shared season stats cache: ${error.message}`);
  if (existing?.source === CACHE_SOURCE) return JSON.parse(existing.payload);

  const snapshot = await getCompletedOffenseSnapshot({ force: true });
  const now = new Date().toISOString();
  const { error: upsertError } = await supabaseAdmin.from("wrc_season_stats_cache").upsert({
    id: CACHE_ID,
    season: CACHE_SEASON,
    source: CACHE_SOURCE,
    payload: JSON.stringify(snapshot),
    refreshed_at: now,
    updated_at: now,
  }, { onConflict: "id" });
  if (upsertError) throw new Error(`Unable to warm shared season stats cache: ${upsertError.message}`);
  return snapshot;
}

export async function refreshSharedSeasonStats(): Promise<{ playerCount: number }> {
  const snapshot = await getCompletedOffenseSnapshot({ force: true });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("wrc_season_stats_cache").upsert({
    id: CACHE_ID,
    season: CACHE_SEASON,
    source: CACHE_SOURCE,
    payload: JSON.stringify(snapshot),
    refreshed_at: now,
    updated_at: now,
  }, { onConflict: "id" });
  if (error) throw new Error(`Unable to refresh shared season stats cache: ${error.message}`);
  return { playerCount: Object.keys(snapshot as Record<string, unknown>).length };
}

export async function refreshSharedSeasonStatsSchedule(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ ok: true, ...(await refreshSharedSeasonStats()) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { refresh: "shared-season-stats" },
    });
  }
}

export { CACHE_ID as SHARED_SEASON_STATS_CACHE_ID };
