import type { Request, Response } from "express";
import { storageGetSignedUrl } from "./storage";

const COMPLETED_OFFENSE_SNAPSHOT_KEY = "free_agents_2025_offense_complete_v4_cb0d706f.json";
let cachedSnapshot: { value: unknown; expiresAt: number } | null = null;
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCompletedOffenseSnapshot(options: { force?: boolean } = {}): Promise<unknown> {
  if (!options.force && cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) return cachedSnapshot.value;
  const signedUrl = await storageGetSignedUrl(COMPLETED_OFFENSE_SNAPSHOT_KEY);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Completed stat snapshot fetch failed (${response.status})`);
  const value = await response.json();
  cachedSnapshot = { value, expiresAt: Date.now() + MEMORY_TTL_MS };
  return value;
}

export async function serveCompletedOffenseSnapshot(_req: Request, res: Response): Promise<void> {
  try {
    const { readOrWarmSharedSeasonStats } = await import("./seasonStatsRefresh");
    const snapshot = await readOrWarmSharedSeasonStats();
    // Browser caching here can retain an older completed-season snapshot after
    // a data correction. The app keeps its own versioned stat cache instead.
    res.setHeader("Cache-Control", "no-store");
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
