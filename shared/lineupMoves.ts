import { normalizePlayerName } from "./playerNameMatch";
import type { RosterPlayerWithId } from "./effectiveStarters";

export type LineupMoveRow = { slot: string; player_id?: string | null; player_name: string; is_bench: boolean };

const BENCH = "BENCH";
const normalizeSlot = (slot: string) => slot.replace(/^(RB|WR|TE)\d+$/, "$1");

/**
 * Which roster players does a lineup save move, compared with the lineup the
 * team is effectively using now (the baseline)? A player "moves" when he goes
 * from the bench into a starter slot, from a starter slot to the bench, or
 * from one starter slot to another. Reordering the bench is not a move, and
 * RB1/RB2 style slot numbers are treated as the same slot, as scoring does.
 */
export function findMovedLineupPlayers<T extends RosterPlayerWithId>(
  baselineStarters: ReadonlyArray<{ slot: string; player: T }>,
  newRows: readonly LineupMoveRow[],
  roster: readonly T[],
): T[] {
  const before = new Map<string, string>();
  for (const { slot, player } of baselineStarters) before.set(player.id, normalizeSlot(slot));

  const byName = new Map(roster.map(p => [normalizePlayerName(p.name), p]));
  const after = new Map<string, string>();
  for (const row of newRows) {
    const player = byName.get(normalizePlayerName(row.player_name));
    if (!player) continue;
    after.set(player.id, row.is_bench ? BENCH : normalizeSlot(row.slot));
  }

  return roster.filter(p => (before.get(p.id) ?? BENCH) !== (after.get(p.id) ?? BENCH));
}
