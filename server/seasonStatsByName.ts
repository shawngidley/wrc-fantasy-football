import { normalizePlayerName } from "../shared/playerNameMatch";
import { supabaseAdmin } from "./supabaseAdmin";

export type NamedStatRow = { player_name: string };

/**
 * Pairs each requested player name with its season-stats row.
 *
 * Exists because the two sides spell players differently. A page asks using
 * the draft pool's name, which comes from the live provider and carries the
 * generational suffix ("James Cook III"); player_weekly_stats stores a
 * ROSTERED player under the WRC roster name instead, straight from the
 * commissioner's import ("James Cook") -- see buildWeeklyStatRowInputs, whose
 * first loop writes `name: player.name`. An exact `.in("player_name", ...)`
 * therefore returned nothing for that player and the page showed blank FPG and
 * blank season stats, with no error anywhere to notice.
 *
 * Paired with the name the caller ASKED for, not the name the row is stored
 * under, so a caller can look the result up with the same string it passed in.
 * Exact spelling wins over a normalized match, so two rows that normalize
 * alike can never steal each other's exact hit.
 */
export function matchRowsToRequestedNames<T extends NamedStatRow>(
  rows: readonly T[],
  requestedNames: readonly string[],
): Array<{ name: string; row: T }> {
  const exact = new Map<string, T>();
  const normalized = new Map<string, T>();
  for (const row of rows) {
    const stored = String(row.player_name ?? "");
    if (!exact.has(stored)) exact.set(stored, row);
    const key = normalizePlayerName(stored);
    if (key && !normalized.has(key)) normalized.set(key, row);
  }
  const matched: Array<{ name: string; row: T }> = [];
  for (const name of requestedNames) {
    const hit = exact.get(name) ?? normalized.get(normalizePlayerName(name));
    if (hit) matched.push({ name, row: hit });
  }
  return matched;
}

const STAT_PAGE_SIZE = 1000;

/**
 * Every row of a season-stats table for one season, paged past PostgREST's
 * 1000-row cap. Ordered by player_name so the pages tile without gaps or
 * repeats.
 *
 * Only called for the names an exact lookup missed, but note that on a page
 * asking about hundreds of players there is almost always at least one such
 * name -- plenty of pool players have never recorded a week -- so in practice
 * this runs on most Free Agents loads. That is accepted: it is one extra read
 * of a single-row-per-player table, and both client hooks cache it (5 minutes
 * for the current season, an hour for historical).
 */
export async function loadSeasonStatRows(
  table: "season_stats_current" | "season_stats_historical",
  season: number,
): Promise<Array<Record<string, unknown> & NamedStatRow>> {
  const all: Array<Record<string, unknown> & NamedStatRow> = [];
  for (let from = 0; ; from += STAT_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.from(table)
      .select("*")
      .eq("season", season)
      .order("player_name", { ascending: true })
      .range(from, from + STAT_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`);
    const page = (data ?? []) as Array<Record<string, unknown> & NamedStatRow>;
    all.push(...page);
    if (page.length < STAT_PAGE_SIZE) return all;
  }
}
