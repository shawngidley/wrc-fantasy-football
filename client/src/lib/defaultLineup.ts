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
