import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import { supabaseAdmin } from "./supabaseAdmin";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "../shared/currentDraftPlayerUniverse2026";
import { normalizeNFLTeamCode } from "../shared/nflTeamCodes";

// nflverse republishes this file continuously through the season as trades,
// signings, and releases happen -- unlike currentDraftPlayerUniverse2026.ts,
// which is a hand-generated, point-in-time snapshot (confirmed stale for
// Kayshon Boutte's trade to Houston: the pool still showed New England a
// week after the trade happened). This refresh keeps a live nfl_team
// override on top of that static pool without needing to regenerate or
// redeploy it.
const ROSTER_URL = "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv";

interface RosterRow {
  espn_id?: string;
  team?: string;
}

async function fetchRosterCsv(): Promise<RosterRow[]> {
  const response = await fetch(ROSTER_URL, { redirect: "follow" });
  if (!response.ok) throw new Error(`Roster CSV fetch failed: ${response.status}`);
  const csvText = await response.text();
  return parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true }) as RosterRow[];
}

export interface NflTeamAssignment {
  sourcePlayerId: string;
  nflTeam: string;
  byeWeek: number | null;
}

export async function refreshNflTeamAssignments(): Promise<{ updated: number }> {
  const rows = await fetchRosterCsv();

  // Bye weeks aren't in the roster CSV, but the pool already has a correct
  // bye week for every team via whichever players haven't moved -- build a
  // team -> bye lookup from the pool itself rather than a second data source.
  const byeByTeam = new Map<string, number>();
  for (const player of CURRENT_DRAFT_PLAYER_UNIVERSE_2026) {
    if (player.bye != null && !byeByTeam.has(player.nflTeam)) byeByTeam.set(player.nflTeam, player.bye);
  }

  const assignments: NflTeamAssignment[] = [];
  for (const row of rows) {
    if (!row.espn_id || !row.team) continue;
    // nflverse's roster CSV uses different team abbreviation conventions
    // than this app's established ones in places -- confirmed for the Rams
    // specifically (nflverse: "LA", this app's pool and everywhere else:
    // "LAR"), which broke both the team display and the bye-week lookup
    // below (byeByTeam is keyed by the pool's "LAR", so looking it up with
    // unnormalized "LA" always missed). Route through the same shared
    // normalizer used everywhere else in the app for this class of
    // upstream-vs-established naming mismatch, rather than special-casing
    // just this one team.
    const team = normalizeNFLTeamCode(row.team);
    assignments.push({
      sourcePlayerId: row.espn_id,
      nflTeam: team,
      byeWeek: byeByTeam.get(team) ?? null,
    });
  }

  if (!assignments.length) throw new Error("Roster CSV parsed but produced no usable rows");

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("nfl_team_assignments").upsert(
    assignments.map(a => ({
      source_player_id: a.sourcePlayerId,
      nfl_team: a.nflTeam,
      bye_week: a.byeWeek,
      refreshed_at: now,
    })),
    { onConflict: "source_player_id" },
  );
  if (error) throw new Error(`Unable to upsert nfl_team_assignments: ${error.message}`);

  return { updated: assignments.length };
}

export async function refreshNflTeamAssignmentsSchedule(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ ok: true, ...(await refreshNflTeamAssignments()) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { refresh: "nfl-team-assignments" },
    });
  }
}
