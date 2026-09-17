import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { getLineupDefaultWeek } from "../client/src/lib/scheduleData2026";
import {
  CACHE_KEYS,
  fetchAndStore,
  injuriesThresholdMs,
  isDue,
  isLikelyNflGameWindow,
  newsThresholdMs,
  nyDateString,
  RANKINGS_PROJECTIONS_THRESHOLD_MS,
  shouldSkipForBudget,
  type FantasyProsDatasetKind,
} from "./fantasyprosFetcher";

const SEASON = 2026;
const RANK_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST", "ALL"];
const PROJECTION_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

interface PlannedFetch {
  kind: FantasyProsDatasetKind;
  key: string;
  path: string;
  ttlMs: number;
}

function buildPlan(week: number, inGameWindow: boolean): PlannedFetch[] {
  return [
    {
      kind: "news",
      key: CACHE_KEYS.news(),
      path: `/nfl/news?${new URLSearchParams({ limit: "100", order_by: "updated" })}`,
      ttlMs: newsThresholdMs(inGameWindow),
    },
    {
      kind: "injuries",
      key: CACHE_KEYS.injuries(SEASON, week),
      path: `/nfl/injuries?year=${SEASON}&week=${week}&include_probabilities=true`,
      ttlMs: injuriesThresholdMs(inGameWindow),
    },
    ...RANK_POSITIONS.map(position => ({
      kind: "ranks" as const,
      key: CACHE_KEYS.ranks(position, week),
      path: `/nfl/${SEASON}/consensus-rankings?${new URLSearchParams({ position, scoring: "PPR", type: week > 0 ? "WEEKLY" : "DRAFT", week: String(week) })}`,
      ttlMs: RANKINGS_PROJECTIONS_THRESHOLD_MS,
    })),
    ...PROJECTION_POSITIONS.map(position => ({
      kind: "projections" as const,
      key: CACHE_KEYS.projections(position, week),
      path: `/nfl/${SEASON}/projections?${new URLSearchParams({ position, week: String(week) })}`,
      ttlMs: RANKINGS_PROJECTIONS_THRESHOLD_MS,
    })),
  ];
}

async function loadFetchedAtByKey(keys: string[]): Promise<Map<string, string | null>> {
  const { data, error } = await supabaseAdmin.from("fantasypros_cache").select("key, fetched_at").in("key", keys);
  if (error) throw new Error(`Unable to read FantasyPros cache metadata: ${error.message}`);
  const map = new Map<string, string | null>();
  for (const row of data ?? []) map.set(row.key, row.fetched_at);
  return map;
}

export interface FantasyProsRefreshResult {
  fetched: string[];
  skipped: { key: string; reason: string }[];
  callsToday: number;
}

export async function processFantasyProsRefresh(): Promise<FantasyProsRefreshResult> {
  const week = getLineupDefaultWeek() || 1;
  const inGameWindow = isLikelyNflGameWindow();
  const plan = buildPlan(week, inGameWindow);

  const [{ data: usageRow }, fetchedAtByKey] = await Promise.all([
    supabaseAdmin.from("fantasypros_usage").select("calls").eq("day", nyDateString()).maybeSingle(),
    loadFetchedAtByKey(plan.map(item => item.key)),
  ]);
  let callsToday = usageRow?.calls ?? 0;

  const fetched: string[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const item of plan) {
    if (!isDue(fetchedAtByKey.get(item.key) ?? null, item.ttlMs)) {
      skipped.push({ key: item.key, reason: "not due" });
      continue;
    }
    const budgetDecision = shouldSkipForBudget(item.kind, callsToday, inGameWindow);
    if (budgetDecision.skip) {
      skipped.push({ key: item.key, reason: budgetDecision.reason! });
      continue;
    }
    try {
      const result = await fetchAndStore(item.key, item.path, item.ttlMs);
      if (result.status === "fetched") {
        fetched.push(item.key);
        callsToday += 1;
      } else if (result.status === "rate-limited") {
        skipped.push({ key: item.key, reason: "429 from FantasyPros" });
        callsToday += 1;
      } else {
        skipped.push({ key: item.key, reason: result.reason ?? "skipped" });
      }
    } catch (error) {
      // One dataset failing (network error, non-429 HTTP error, a Supabase
      // write failure) shouldn't stop the rest of this tick's datasets
      // from being attempted.
      skipped.push({ key: item.key, reason: `error: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  return { fetched, skipped, callsToday };
}

export async function fantasyProsRefreshSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const result = await processFantasyProsRefresh();
    console.log(
      `[fantasypros-refresh] fetched: ${result.fetched.join(", ") || "(none)"} | ` +
      `skipped: ${result.skipped.map(s => `${s.key} (${s.reason})`).join(", ") || "(none)"} | ` +
      `calls today: ${result.callsToday}/500`,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { collector: "fantasypros-refresh" },
    });
  }
}
