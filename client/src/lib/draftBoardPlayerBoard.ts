import type { DraftUniversePlayer } from "@shared/draftPlayerUniverse";

export type DraftBoardSortKey = "adp" | "pos" | "name" | "team";
export type DraftBoardSortDirection = "asc" | "desc";

const POSITION_ORDER: Record<DraftUniversePlayer["pos"], number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  K: 4,
  DST: 5,
};

export function resolve2026Adp(player: DraftUniversePlayer, adpMap: Map<string, number>): number | null {
  const liveAdp = adpMap.get(player.name.toLowerCase());
  if (typeof liveAdp === "number" && Number.isFinite(liveAdp) && liveAdp > 0) return liveAdp;
  return Number.isFinite(player.adp) && player.adp > 0 && player.adp < 9999 ? player.adp : null;
}

export function formatDraftBoardSeasonStat(value: number | undefined, loading: boolean): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(1);
  return loading ? "…" : "—";
}

export function sortDraftBoardPlayers(
  players: readonly DraftUniversePlayer[],
  adpMap: Map<string, number>,
  key: DraftBoardSortKey,
  direction: DraftBoardSortDirection,
): DraftUniversePlayer[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...players].sort((left, right) => {
    let comparison = 0;
    if (key === "adp") {
      const leftAdp = resolve2026Adp(left, adpMap);
      const rightAdp = resolve2026Adp(right, adpMap);
      if (leftAdp === null && rightAdp !== null) comparison = 1;
      else if (leftAdp !== null && rightAdp === null) comparison = -1;
      else if (leftAdp !== null && rightAdp !== null) comparison = leftAdp - rightAdp;
    } else if (key === "pos") {
      comparison = POSITION_ORDER[left.pos] - POSITION_ORDER[right.pos];
    } else if (key === "team") {
      comparison = left.nflTeam.localeCompare(right.nflTeam);
    } else {
      comparison = left.name.localeCompare(right.name);
    }

    if (comparison === 0) comparison = left.name.localeCompare(right.name);
    return comparison * multiplier;
  });
}
