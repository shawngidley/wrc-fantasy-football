import { normalizePlayerName } from "./playerNameMatch";
import { resolveRosterPlayerForLineupEntry, type LineupEntryForResolution, type RosterPlayerRow } from "./rosterPlayerResolution";
import { buildDefaultStarters, fillEmptyStarterSlots, STARTER_SLOT_ORDER } from "./defaultLineup";

export type SavedLineupRow = LineupEntryForResolution & { is_bench?: boolean | null };
export type RosterPlayerWithId = RosterPlayerRow & { id: string };

/**
 * The starters a team is actually scored on for a week: the same rule Live
 * Scoring, the Lineup page and the Standings card use.
 *
 *   1. Each saved starter is looked up on THIS team's roster only (id, then
 *      normalized name, then the team's own DST for the DST slot). A saved
 *      player who is no longer on the roster is not scored for this team.
 *   2. Any starter slot left empty (a dropped player, a FAAB add that was
 *      never saved into the lineup) is filled from the rest of the roster,
 *      best ADP first (fillEmptyStarterSlots).
 *   3. A team with no saved lineup at all gets the default best-ADP lineup.
 *
 * Official weekly scoring used to look saved names up across every team's
 * players and skip step 2, so it could score a player the team had already
 * dropped and ignore the player who replaced him.
 */
export function buildEffectiveStarters<T extends RosterPlayerWithId>(
  savedRows: readonly SavedLineupRow[],
  roster: readonly T[],
  pool: readonly { name: string; adp: number }[],
): Array<{ slot: string; player: T }> {
  if (savedRows.length === 0) return buildDefaultStarters(roster, pool);

  const byId = new Map<string, RosterPlayerRow>(roster.map(p => [p.id, p]));
  const byName = new Map<string, RosterPlayerRow>(roster.map(p => [normalizePlayerName(p.name), p]));
  const used = new Set<string>();
  const starters: Array<{ slot: string; player: T }> = [];
  for (const row of savedRows) {
    if (row.is_bench) continue;
    const player = resolveRosterPlayerForLineupEntry(row, byId, byName, [...roster] as RosterPlayerRow[]) as T | undefined;
    if (!player || used.has(player.id)) continue;
    used.add(player.id);
    starters.push({ slot: row.slot.replace(/^(RB|WR|TE)\d+$/, "$1"), player });
  }
  const bench = roster.filter(p => !used.has(p.id));
  return fillEmptyStarterSlots(starters, bench, STARTER_SLOT_ORDER, pool).starters;
}
