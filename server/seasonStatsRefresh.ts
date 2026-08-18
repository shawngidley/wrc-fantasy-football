import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { wrcSeasonStatsCache } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getCompletedOffenseSnapshot } from "./seasonStatsSnapshot";

const CACHE_ID = "completed-offense-2025-id-resolved-v4";
const CACHE_SEASON = 2025;
const CACHE_SOURCE = "nflverse-completed-2025-id-resolved";

async function seasonStatsDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for shared season stats");
  return db;
}

export async function readOrWarmSharedSeasonStats(): Promise<unknown> {
  const db = await seasonStatsDb();
  const existing = (await db.select().from(wrcSeasonStatsCache).where(eq(wrcSeasonStatsCache.id, CACHE_ID)).limit(1))[0];
  if (existing) return JSON.parse(existing.payload);

  const snapshot = await getCompletedOffenseSnapshot({ force: true });
  await db.insert(wrcSeasonStatsCache).values({
    id: CACHE_ID,
    season: CACHE_SEASON,
    source: CACHE_SOURCE,
    payload: JSON.stringify(snapshot),
    refreshedAt: new Date(),
  });
  return snapshot;
}

export async function refreshSharedSeasonStats(): Promise<{ playerCount: number }> {
  const snapshot = await getCompletedOffenseSnapshot({ force: true });
  const db = await seasonStatsDb();
  await db.insert(wrcSeasonStatsCache).values({
    id: CACHE_ID,
    season: CACHE_SEASON,
    source: CACHE_SOURCE,
    payload: JSON.stringify(snapshot),
    refreshedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: { source: CACHE_SOURCE, payload: JSON.stringify(snapshot), refreshedAt: new Date() },
  });
  return { playerCount: Object.keys(snapshot as Record<string, unknown>).length };
}

export async function refreshSharedSeasonStatsSchedule(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    const db = await seasonStatsDb();
    const config = (await db.select().from(wrcSeasonStatsCache).where(eq(wrcSeasonStatsCache.id, CACHE_ID)).limit(1))[0];
    if (!config?.scheduleCronTaskUid || config.scheduleCronTaskUid !== user.taskUid) {
      res.json({ ok: true, skipped: "unrecognized-schedule" });
      return;
    }
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
