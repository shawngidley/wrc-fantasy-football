import { normalizePlayerName } from "@shared/playerNameMatch";

export interface DefaultLineupPlayer {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
}

/**
 * When a team has no saved lineup for a given week yet, this picks a
 * sensible default: best-ADP player at each starter slot, rather than
 * whatever order the roster happened to come back from the database in
 * (which has no real meaning -- see the comment this was extracted from
 * in LiveScoring.tsx for why that was a systematic, accidental bias).
 */
export function buildDefaultStarters<T extends DefaultLineupPlayer>(
  teamPlayers: readonly T[],
  nflTeamPool: readonly { name: string; adp: number }[],
): Array<{ slot: string; player: T }> {
  const adpByNormalizedName = new Map<string, number>();
  for (const p of nflTeamPool) {
    adpByNormalizedName.set(normalizePlayerName(p.name), p.adp);
  }
  const sortedByAdp = [...teamPlayers].sort((a, b) => {
    const adpA = adpByNormalizedName.get(normalizePlayerName(a.name)) ?? 9999;
    const adpB = adpByNormalizedName.get(normalizePlayerName(b.name)) ?? 9999;
    return adpA - adpB;
  });
  const slotDef: Array<{ slot: string; pos: string }> = [
    { slot: "QB", pos: "QB" },
    { slot: "RB", pos: "RB" },
    { slot: "RB", pos: "RB" },
    { slot: "WR", pos: "WR" },
    { slot: "WR", pos: "WR" },
    { slot: "TE", pos: "TE" },
    { slot: "SFLEX", pos: "QB" },
    { slot: "FLEX", pos: "RB" },
    { slot: "K", pos: "K" },
    { slot: "DST", pos: "DST" },
  ];
  const used = new Set<string>();
  const starters: Array<{ slot: string; player: T }> = [];
  for (const { slot, pos } of slotDef) {
    const candidate = sortedByAdp.find(p => p.position === pos && !used.has(p.id));
    if (candidate) {
      starters.push({ slot, player: candidate });
      used.add(candidate.id);
    }
  }
  return starters;
}

// Which positions may fill each starter slot. Matches the Lineup page's
// STARTER_SLOTS so a slot backfilled here agrees with what the owner sees.
export const STARTER_SLOT_ELIGIBLE: Record<string, string[]> = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  SFLEX: ["QB", "RB", "WR", "TE"], FLEX: ["RB", "WR", "TE"],
  K: ["K"], DST: ["DST"],
};

/**
 * Fill any starter slot left empty by a saved lineup, drawing from the bench.
 *
 * A saved lineup that was carried forward (or saved only partially) can leave
 * starter slots empty once players named in it were dropped or traded, while
 * the team's real players sit on the bench. This fills each empty slot in
 * `slotOrder` with the best-ADP eligible bench player, so live scoring and the
 * official weekly score never show a short lineup or bench a real starter just
 * because the saved lineup is stale. Returns the completed starters and the
 * bench with the promoted players removed.
 */
export function fillEmptyStarterSlots<T extends DefaultLineupPlayer>(
  starters: ReadonlyArray<{ slot: string; player: T }>,
  bench: readonly T[],
  slotOrder: readonly string[],
  nflTeamPool: readonly { name: string; adp: number }[],
): { starters: Array<{ slot: string; player: T }>; bench: T[] } {
  const adpByName = new Map<string, number>();
  for (const p of nflTeamPool) adpByName.set(normalizePlayerName(p.name), p.adp);
  const adpOf = (name: string) => adpByName.get(normalizePlayerName(name)) ?? 9999;

  const used = new Set(starters.map(s => s.player.id));
  // Which slot instances are already filled: walk slotOrder and consume one
  // filled entry per matching label, so duplicate slots (RB, RB) are counted.
  const filled = new Map<string, number>();
  for (const s of starters) filled.set(s.slot, (filled.get(s.slot) ?? 0) + 1);
  const gaps: string[] = [];
  for (const slot of slotOrder) {
    const have = filled.get(slot) ?? 0;
    if (have > 0) { filled.set(slot, have - 1); continue; }
    gaps.push(slot);
  }
  // Fill strict slots before SFLEX/FLEX so a flex only takes what's left over.
  const flexRank: Record<string, number> = { SFLEX: 2, FLEX: 1 };
  gaps.sort((a, b) => (flexRank[a] ?? 0) - (flexRank[b] ?? 0));

  const outStarters = [...starters];
  for (const slot of gaps) {
    const eligible = STARTER_SLOT_ELIGIBLE[slot] ?? [];
    const candidate = bench
      .filter(p => !used.has(p.id) && eligible.includes(p.position))
      .sort((a, b) => adpOf(a.name) - adpOf(b.name))[0];
    if (!candidate) continue;
    outStarters.push({ slot, player: candidate });
    used.add(candidate.id);
  }
  return { starters: outStarters, bench: bench.filter(p => !used.has(p.id)) };
}
