import { supabaseAdmin } from "./supabaseAdmin";

export interface ResolvedLineupRow {
  team_id: string;
  slot: string;
  player_id: string;
  player_name: string;
  is_bench: boolean;
  /** The week the rows were actually saved in. Equals `week` unless carried forward. */
  source_week: number;
}

export interface StoredLineupRow {
  team_id: string;
  week: number;
  slot: string;
  player_id: string;
  player_name: string;
  is_bench: boolean | null;
}

/**
 * The one place that answers "what is this team's lineup for week N".
 *
 * A lineup, once saved, stays in effect for every following week until
 * the owner saves a new one. So if no rows exist for the requested week,
 * the most recent earlier week that has rows is used instead. When rows
 * are carried forward, players no longer on the team's roster (dropped or
 * traded since) are left out, so a stale lineup can never start someone
 * the team doesn't have.
 *
 * Everything that reads lineups goes through here: the Lineup page, Live
 * Scoring, and the weekly finalization that produces the official score.
 * Before this existed only the Lineup page carried forward; scoring and
 * live scoring read the exact week and treated an unsaved week as empty.
 */
export async function resolveLineupsForWeek(week: number, season: number, teamId?: string): Promise<ResolvedLineupRow[]> {
  let query = supabaseAdmin
    .from("lineups")
    .select("team_id, week, slot, player_id, player_name, is_bench")
    .eq("season", season)
    .lte("week", week);
  if (teamId) query = query.eq("team_id", teamId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load lineups: ${error.message}`);

  // Most recent saved week per team, at or before the requested week.
  const latestWeekByTeam = new Map<string, number>();
  for (const row of (data ?? []) as StoredLineupRow[]) {
    const current = latestWeekByTeam.get(row.team_id);
    if (current === undefined || row.week > current) latestWeekByTeam.set(row.team_id, row.week);
  }
  if (latestWeekByTeam.size === 0) return [];

  const carriedTeams = Array.from(latestWeekByTeam.entries()).filter(([, w]) => w < week).map(([id]) => id);
  const rosterIdsByTeam = new Map<string, Set<string>>();
  if (carriedTeams.length > 0) {
    const { data: roster, error: rosterError } = await supabaseAdmin
      .from("players")
      .select("id, team_id")
      .in("team_id", carriedTeams);
    if (rosterError) throw new Error(`Unable to validate carried-forward lineups: ${rosterError.message}`);
    for (const p of roster ?? []) {
      if (!p.team_id) continue;
      if (!rosterIdsByTeam.has(p.team_id)) rosterIdsByTeam.set(p.team_id, new Set());
      rosterIdsByTeam.get(p.team_id)!.add(p.id);
    }
  }

  return selectEffectiveLineupRows((data ?? []) as StoredLineupRow[], week, rosterIdsByTeam);
}

/**
 * Pure selection step, split out for tests: keep only each team's most
 * recent saved week at or before `week`; when that week is earlier than
 * `week` (carried forward), drop players no longer on the roster.
 */
export function selectEffectiveLineupRows(
  rows: StoredLineupRow[],
  week: number,
  rosterIdsByTeam: Map<string, Set<string>>,
): ResolvedLineupRow[] {
  const latestWeekByTeam = new Map<string, number>();
  for (const row of rows) {
    if (row.week > week) continue;
    const current = latestWeekByTeam.get(row.team_id);
    if (current === undefined || row.week > current) latestWeekByTeam.set(row.team_id, row.week);
  }
  const out: ResolvedLineupRow[] = [];
  for (const row of rows) {
    if (row.week !== latestWeekByTeam.get(row.team_id)) continue;
    const carried = row.week < week;
    if (carried && !rosterIdsByTeam.get(row.team_id)?.has(row.player_id)) continue;
    out.push({
      team_id: row.team_id,
      slot: row.slot,
      player_id: row.player_id,
      player_name: row.player_name,
      is_bench: Boolean(row.is_bench),
      source_week: row.week,
    });
  }
  return out;
}
