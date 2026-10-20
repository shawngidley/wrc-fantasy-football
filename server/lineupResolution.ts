import { normalizePlayerName } from "../shared/playerNameMatch";
import { resolveRosterPlayerForLineupEntry, type RosterPlayerRow } from "../shared/rosterPlayerResolution";
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
 * "On the roster" uses the same matching as the weekly finalizer and the
 * matchup score hooks (resolveRosterPlayerForLineupEntry): player_id first,
 * then normalized name, then -- for the DST slot -- the team's own DST. Saved
 * lineups carry inconsistent ids (some were written with draft-pool ids like
 * "dp14127" while the roster row has a different id), and every reader already
 * resolves by name, so requiring an exact id here made a perfectly good lineup
 * vanish the moment it was carried into the next week.
 *
 * Everything that reads lineups goes through here: the Lineup page, Live
 * Scoring, and the weekly finalization that produces the official score.
 * Before this existed only the Lineup page carried forward; scoring and
 * live scoring read the exact week and treated an unsaved week as empty.
 */
export async function resolveLineupsForWeek(week: number, season: number, teamId?: string): Promise<ResolvedLineupRow[]> {
  const data = await loadLineupRows(week, season, teamId);

  // Most recent saved week per team, at or before the requested week.
  const latestWeekByTeam = new Map<string, number>();
  for (const row of data) {
    const current = latestWeekByTeam.get(row.team_id);
    if (current === undefined || row.week > current) latestWeekByTeam.set(row.team_id, row.week);
  }
  if (latestWeekByTeam.size === 0) return [];

  const carriedTeams = Array.from(latestWeekByTeam.entries()).filter(([, w]) => w < week).map(([id]) => id);
  const rosterIdsByTeam = new Map<string, Set<string>>();
  const rosterByTeam = new Map<string, RosterPlayerRow[]>();
  if (carriedTeams.length > 0) {
    const { data: roster, error: rosterError } = await supabaseAdmin
      .from("players")
      .select("id, name, position, nfl_team, team_id")
      .in("team_id", carriedTeams);
    if (rosterError) throw new Error(`Unable to validate carried-forward lineups: ${rosterError.message}`);
    for (const p of roster ?? []) {
      if (!p.team_id) continue;
      if (!rosterIdsByTeam.has(p.team_id)) rosterIdsByTeam.set(p.team_id, new Set());
      rosterIdsByTeam.get(p.team_id)!.add(p.id);
      if (!rosterByTeam.has(p.team_id)) rosterByTeam.set(p.team_id, []);
      rosterByTeam.get(p.team_id)!.push(p as RosterPlayerRow);
    }
  }

  return selectEffectiveLineupRows(data, week, rosterIdsByTeam, rosterByTeam);
}

// Supabase silently caps a single select at 1000 rows -- no error, it just
// stops. A league-wide read (no teamId) pulls every team's lineup for every
// week up to the one requested: 12 teams x 18 rows = 216 rows per saved week, so
// Week 5 (1080 rows) was the first to cross the cap. Because the unordered
// result came back in insertion order, the rows dropped were always the NEWEST
// saves. Teams whose Week 5 save fell past the cap silently resolved to their
// Week 4 lineup (carried forward) -- Live Scoring and the weekly finalizer
// showed a stale lineup while the Lineup page, which reads one team (90 rows),
// showed the real one. Page through every row in a stable order so the result
// is complete no matter how many weeks have been saved. Same fix, and the same
// page-and-break idiom, as loadAllPlayerWeeklyStatsForSeason in
// scheduledSeasonStatsPrecompute.ts, which hit this cap first.
//
// The order is (week, team_id, slot, player_id) -- all columns this select
// already reads, and unique per row, since one slot holds one player in a given
// team's week. Paging needs a TOTAL order: any tie at a page boundary lets
// Postgres return a row twice or not at all across two LIMIT/OFFSET queries.
const LINEUP_PAGE_SIZE = 1000;

async function loadLineupRows(week: number, season: number, teamId?: string): Promise<StoredLineupRow[]> {
  const all: StoredLineupRow[] = [];
  for (let from = 0; ; from += LINEUP_PAGE_SIZE) {
    let query = supabaseAdmin
      .from("lineups")
      .select("team_id, week, slot, player_id, player_name, is_bench")
      .eq("season", season)
      .lte("week", week);
    if (teamId) query = query.eq("team_id", teamId);
    const { data, error } = await query
      .order("week", { ascending: true })
      .order("team_id", { ascending: true })
      .order("slot", { ascending: true })
      .order("player_id", { ascending: true })
      .range(from, from + LINEUP_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load lineups: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as StoredLineupRow[]));
    if (data.length < LINEUP_PAGE_SIZE) break;
  }
  return all;
}

/**
 * Pure selection step, split out for tests: keep only each team's most
 * recent saved week at or before `week`; when that week is earlier than
 * `week` (carried forward), drop players no longer on the roster.
 *
 * `rosterByTeam` (optional) lets a carried row match its roster player by
 * normalized name, or by the team's DST for the DST slot, when its saved id
 * isn't on the roster. Without it only exact ids match, as before.
 */
export function selectEffectiveLineupRows(
  rows: StoredLineupRow[],
  week: number,
  rosterIdsByTeam: Map<string, Set<string>>,
  rosterByTeam?: Map<string, RosterPlayerRow[]>,
): ResolvedLineupRow[] {
  const latestWeekByTeam = new Map<string, number>();
  for (const row of rows) {
    if (row.week > week) continue;
    const current = latestWeekByTeam.get(row.team_id);
    if (current === undefined || row.week > current) latestWeekByTeam.set(row.team_id, row.week);
  }

  const nameIndexByTeam = new Map<string, Map<string, RosterPlayerRow>>();
  const isOnRoster = (row: StoredLineupRow): boolean => {
    if (rosterIdsByTeam.get(row.team_id)?.has(row.player_id)) return true;
    const roster = rosterByTeam?.get(row.team_id);
    if (!roster || roster.length === 0) return false;
    let byName = nameIndexByTeam.get(row.team_id);
    if (!byName) {
      byName = new Map(roster.map(p => [normalizePlayerName(p.name), p]));
      nameIndexByTeam.set(row.team_id, byName);
    }
    return resolveRosterPlayerForLineupEntry(row, new Map(), byName, roster) !== undefined;
  };

  const out: ResolvedLineupRow[] = [];
  for (const row of rows) {
    if (row.week !== latestWeekByTeam.get(row.team_id)) continue;
    const carried = row.week < week;
    if (carried && !isOnRoster(row)) continue;
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
