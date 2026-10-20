import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { aggregateWeeklyStatRows } from "./routers";

const SEASON = 2026;

// Supabase caps a single .select() at 1000 rows. player_weekly_stats crosses
// that mid-season (~480 players x 3+ weeks = 1400+ rows), so a plain select
// silently returned only the first 1000 -- all of the earliest weeks plus a
// sliver of the newest -- which froze most players' season total a game short
// (confirmed live in week 3: only the ~54 players whose newest-week row landed
// inside the first 1000 ever updated). Page through every row in a stable order
// so all weeks are aggregated regardless of how many rows the season has.
async function loadAllPlayerWeeklyStatsForSeason(season: number): Promise<Array<Record<string, unknown>>> {
  const PAGE = 1000;
  const all: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("player_weekly_stats")
      .select("*")
      .eq("season", season)
      .order("player_name", { ascending: true })
      .order("week", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Unable to load player_weekly_stats: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Array<Record<string, unknown>>));
    if (data.length < PAGE) break;
  }
  return all;
}

/**
 * Runs once each morning (see vercel.json). Reads every player_weekly_stats
 * row for the current season, aggregates each player's rows into a season
 * total (via the same aggregateWeeklyStatRows used by the on-request
 * playerStats.seasonStats query), and upserts the results into
 * season_stats_current. The client-facing endpoint then reads directly
 * from that precomputed table -- a plain indexed lookup -- instead of
 * summing rows on every request. This matters most for Free Agents,
 * where a single page load could otherwise mean summing hundreds of
 * players' rows in the same request.
 */
export async function precomputeSeasonStatsSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const data = await loadAllPlayerWeeklyStatsForSeason(SEASON);

    const rowsByPlayer = new Map<string, { position: string; nflTeam: string; rows: Array<Record<string, unknown>> }>();
    for (const row of data) {
      const playerName = String(row.player_name);
      const existing = rowsByPlayer.get(playerName);
      if (existing) {
        existing.rows.push(row);
      } else {
        rowsByPlayer.set(playerName, { position: String(row.position ?? ""), nflTeam: String(row.nfl_team ?? ""), rows: [row] });
      }
    }

    const precomputedRows = Array.from(rowsByPlayer.entries()).map(([playerName, { position, nflTeam, rows }]) => {
      const s = aggregateWeeklyStatRows(rows);
      return {
        season: SEASON, player_name: playerName, position, nfl_team: nflTeam,
        gp: s.gp,
        pass_cmp: s.passCmp, pass_att: s.passAtt, pass_yds: s.passYds, pass_td: s.passTD, pass_int: s.passInt, pass_rating: s.passRating,
        rush_att: s.rushAtt, rush_yds: s.rushYds, rush_td: s.rushTD,
        receptions: s.receptions, targets: s.targets, rec_yds: s.recYds, rec_td: s.recTD,
        fg_made: s.fgMade, fg_att: s.fgAtt, fg_yds: s.fgYds,
        fg_made_1_to_39: s.fgMade1To39, fg_made_40_to_49: s.fgMade40To49, fg_made_50_to_59: s.fgMade50To59, fg_made_60_plus: s.fgMade60Plus,
        xp_made: s.xpMade, xp_att: s.xpAtt,
        sacks: s.sacks, def_int: s.defInt, fumbles_recovered: s.fumblesRecovered, takeaways: s.takeaways,
        def_td: s.defTD, dst_td: s.dstTD, return_td: s.returnTD, safeties: s.safeties, block_kicks: s.blockKicks,
        pts_against: s.ptsAgainst, fumbles_lost: s.fumblesLost, wrc_pts: s.wrcPts, pts_per_game: s.ptsPerGame,
        computed_at: new Date().toISOString(),
      };
    });

    if (precomputedRows.length > 0) {
      const { error: upsertError } = await supabaseAdmin.from("season_stats_current").upsert(precomputedRows, { onConflict: "season,player_name" });
      if (upsertError) throw new Error(`Unable to upsert season_stats_current: ${upsertError.message}`);
    }

    res.json({ ok: true, playersUpdated: precomputedRows.length });
  } catch (error) {
    console.error("[precomputeSeasonStatsSchedule] failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { finalization: "season-stats-precompute" },
    });
  }
}
