import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { aggregateWeeklyStatRows } from "./routers";

const SEASON = 2026;

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
    const { data, error } = await supabaseAdmin.from("player_weekly_stats").select("*").eq("season", SEASON);
    if (error) throw new Error(`Unable to load player_weekly_stats: ${error.message}`);

    const rowsByPlayer = new Map<string, { position: string; nflTeam: string; rows: typeof data }>();
    for (const row of data ?? []) {
      const existing = rowsByPlayer.get(row.player_name);
      if (existing) {
        existing.rows.push(row);
      } else {
        rowsByPlayer.set(row.player_name, { position: row.position, nflTeam: row.nfl_team, rows: [row] });
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
