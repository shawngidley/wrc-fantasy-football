import { fillEmptyStarterSlots, STARTER_SLOT_ORDER } from "@shared/defaultLineup";

type SeedPlayer = { id: string; name: string; pos: string; nflTeam: string };

const normalizeSlot = (slot: string) => slot.replace(/^(RB|WR|TE)\d+$/, "$1");

/**
 * Seeds the Lineup page's starters from a saved lineup.
 *
 * 1. Every slot whose saved player is still on the roster gets him back.
 * 2. Any slot left empty (the saved player was dropped or traded, or a FAAB add
 *    was never saved into the lineup) is filled from the rest of the roster
 *    with fillEmptyStarterSlots, best ADP first.
 *
 * Step 2 is the same fill official scoring, Live Scoring and the server's lock
 * check use (buildEffectiveStarters), so the page, the score and the saved
 * lineup agree on who is starting. The page used to take the first eligible
 * player in roster order instead, which could show a different starter than
 * the one being scored.
 */
export function seedStartersFromSaved<P extends SeedPlayer>(
  players: readonly P[],
  savedLineup: Readonly<Record<string, string>>,
  slotDefs: readonly { slot: string; eligible: readonly string[] }[],
  pool: readonly { name: string; adp: number }[],
  keyOf: (name: string) => string,
): { bySlot: Map<string, P>; bench: P[] } {
  const remaining = [...players];
  const bySlot = new Map<string, P>();
  for (const { slot } of slotDefs) {
    const savedName = savedLineup[slot];
    if (!savedName) continue;
    const idx = remaining.findIndex(p => keyOf(p.name) === keyOf(savedName));
    if (idx === -1) continue;
    bySlot.set(slot, remaining.splice(idx, 1)[0]);
  }

  const adapt = (p: P) => ({ id: p.id, name: p.name, position: p.pos, nfl_team: p.nflTeam, ref: p });
  const kept = Array.from(bySlot.entries()).map(([slot, p]) => ({ slot: normalizeSlot(slot), player: adapt(p) }));
  const filled = fillEmptyStarterSlots(kept, remaining.map(adapt), STARTER_SLOT_ORDER, pool);

  // Added entries come after the kept ones. Give each the first empty page slot of its kind (RB1 before RB2).
  for (const { slot, player } of filled.starters.slice(kept.length)) {
    const target = slotDefs.find(def => normalizeSlot(def.slot) === slot && !bySlot.has(def.slot));
    if (target) bySlot.set(target.slot, player.ref);
  }
  return { bySlot, bench: filled.bench.map(p => p.ref) };
}
