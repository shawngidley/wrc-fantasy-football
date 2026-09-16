import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { mapWithConcurrency } from "./routers";
import { calculateSeasonRow, buildLabelMap, sumGameStats, extractFromGamelog, extractFromSeasonTotals, getPrimarySeasonTeam, type SeasonStatRow } from "../shared/espnSeasonStats";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "../shared/currentDraftPlayerUniverse2026";

const ESPN_TIMEOUT_MS = 8_000;
const CONCURRENCY = 10;

/**
 * Fetches one player's ESPN gamelog for a given year, directly (no proxy
 * needed server-side -- the proxy exists purely for browser CORS, which
 * doesn't apply to a server-to-server request). Same parsing as the
 * client's fetchSeasonStats (client/src/hooks/useESPNSeasonStats.ts),
 * duplicated here rather than imported since that function itself uses
 * browser-only APIs (fetch on a relative URL, sessionStorage) this
 * server-side version can't share.
 */
async function fetchHistoricalSeasonRow(espnId: string, year: number, pos: string): Promise<SeasonStatRow | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const gamelogUrl = new URL(`https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog`);
    gamelogUrl.searchParams.set("season", String(year));
    const res = await fetch(gamelogUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const d = await res.json();

    const labels: string[] = d.labels ?? [];
    if (!labels.length) {
      const statsUrl = new URL(`https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/stats`);
      statsUrl.searchParams.set("season", String(year));
      const fallbackRes = await fetch(statsUrl, { signal: controller.signal });
      if (!fallbackRes.ok) return null;
      const fallbackData = await fallbackRes.json();
      const fallback = extractFromSeasonTotals(fallbackData.categories ?? [], fallbackData.teams ?? {}, year);
      return fallback ? calculateSeasonRow(year, pos, fallback) : null;
    }

    type ESPNGameEvent = { eventId?: string; stats?: string[] };
    const seasonTypes: Array<{ categories?: Array<{ events?: ESPNGameEvent[] }> }> = d.seasonTypes ?? [];
    let regularEvents: ESPNGameEvent[] = [];
    for (const st of seasonTypes) {
      for (const cat of st.categories ?? []) {
        const evs = cat.events ?? [];
        if (evs.length > regularEvents.length) regularEvents = evs;
      }
    }
    if (!regularEvents.length) return null;

    const gp = regularEvents.length;
    const lm = buildLabelMap(labels);
    const totals = sumGameStats(regularEvents, Object.fromEntries(Object.entries(lm).map(([k, v]) => [k, v])));
    const extracted = extractFromGamelog(totals, gp, labels);
    return calculateSeasonRow(year, pos, { ...extracted, team: getPrimarySeasonTeam(regularEvents, d.events ?? {}) });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Manually-triggered, one-time-per-year backfill (not on the cron
 * schedule -- these seasons are permanently finished and never need a
 * recurring refresh once filled in). Call with ?year=2023, ?year=2024,
 * or ?year=2025, once each.
 */
export async function backfillHistoricalSeasonStats(req: Request, res: Response): Promise<void> {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2025) {
    res.status(400).json({ error: "Provide a valid ?year= (e.g. 2023, 2024, or 2025)." });
    return;
  }
  try {
    const players = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(p => p.pos !== "DST" && p.sourcePlayerId);
    let succeeded = 0;
    let skipped = 0;

    await mapWithConcurrency(players, CONCURRENCY, async player => {
      const row = await fetchHistoricalSeasonRow(player.sourcePlayerId as string, year, player.pos);
      if (!row || row.gp <= 0) {
        skipped += 1;
        return;
      }
      const { error } = await supabaseAdmin.from("season_stats_historical").upsert({
        season: year, player_name: player.name, position: player.pos, nfl_team: row.team ?? player.nflTeam,
        gp: row.gp,
        pass_cmp: row.passCmp ?? 0, pass_att: row.passAtt ?? 0, pass_yds: row.passYds ?? 0, pass_td: row.passTD ?? 0, pass_int: row.passInt ?? 0, pass_rating: row.passRating ?? 0,
        rush_att: row.rushAtt ?? 0, rush_yds: row.rushYds ?? 0, rush_td: row.rushTD ?? 0,
        receptions: row.rec ?? 0, targets: row.recTargets ?? 0, rec_yds: row.recYds ?? 0, rec_td: row.recTD ?? 0,
        fg_made: row.fgMade ?? 0, fg_att: row.fgAtt ?? 0, xp_made: row.xpMade ?? 0, xp_att: row.xpAtt ?? 0,
        sacks: row.sacks ?? 0, def_int: row.defInt ?? 0, fumbles_recovered: row.fumblesRecovered ?? 0, def_td: row.defTD ?? 0,
        fumbles_lost: row.fumblesLost ?? 0, wrc_pts: row.wrcPts ?? 0, pts_per_game: row.wrcPtsPerGame ?? 0,
        computed_at: new Date().toISOString(),
      }, { onConflict: "season,player_name" });
      if (error) {
        console.error(`[backfillHistoricalSeasonStats] upsert failed for ${player.name} (${year}): ${error.message}`);
        skipped += 1;
      } else {
        succeeded += 1;
      }
    });

    res.json({ ok: true, year, playersConsidered: players.length, succeeded, skipped });
  } catch (error) {
    console.error("[backfillHistoricalSeasonStats] failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { backfill: "historical-season-stats", year },
    });
  }
}
