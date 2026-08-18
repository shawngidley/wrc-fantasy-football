import type { DraftUniversePlayer } from "@shared/draftPlayerUniverse";

export type DraftBoardSortKey = "adp" | "pos" | "name" | "team" | "queue" | "bye" | "fpts" | "fpg";
export type DraftBoardSortDirection = "asc" | "desc";

export type DraftBoardSortStats = Record<string, { wrcPts?: number; ptsPerGame?: number } | undefined>;

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
  seasonStats: DraftBoardSortStats = {},
  queuedPlayerNames: ReadonlySet<string> = new Set(),
): DraftUniversePlayer[] {
  const multiplier = direction === "asc" ? 1 : -1;
  const compareNullableNumbers = (left: number | undefined, right: number | undefined) => {
    const leftIsValid = typeof left === "number" && Number.isFinite(left);
    const rightIsValid = typeof right === "number" && Number.isFinite(right);
    if (!leftIsValid && rightIsValid) return 1;
    if (leftIsValid && !rightIsValid) return -1;
    if (!leftIsValid || !rightIsValid) return 0;
    return (left as number) - (right as number);
  };
  const isFiniteNumber = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value);
  return [...players].sort((left, right) => {
    let comparison = 0;
    if (key === "adp") {
      const leftAdp = resolve2026Adp(left, adpMap);
      const rightAdp = resolve2026Adp(right, adpMap);
      if (!isFiniteNumber(leftAdp ?? undefined) || !isFiniteNumber(rightAdp ?? undefined)) {
        return compareNullableNumbers(leftAdp ?? undefined, rightAdp ?? undefined);
      }
      comparison = compareNullableNumbers(leftAdp ?? undefined, rightAdp ?? undefined);
    } else if (key === "queue") {
      comparison = Number(queuedPlayerNames.has(left.name.toLowerCase())) - Number(queuedPlayerNames.has(right.name.toLowerCase()));
    } else if (key === "bye") {
      if (!isFiniteNumber(left.bye ?? undefined) || !isFiniteNumber(right.bye ?? undefined)) {
        return compareNullableNumbers(left.bye ?? undefined, right.bye ?? undefined);
      }
      comparison = compareNullableNumbers(left.bye ?? undefined, right.bye ?? undefined);
    } else if (key === "fpts") {
      const leftFpts = seasonStats[left.name.toLowerCase()]?.wrcPts;
      const rightFpts = seasonStats[right.name.toLowerCase()]?.wrcPts;
      if (!isFiniteNumber(leftFpts) || !isFiniteNumber(rightFpts)) return compareNullableNumbers(leftFpts, rightFpts);
      comparison = compareNullableNumbers(leftFpts, rightFpts);
    } else if (key === "fpg") {
      const leftFpg = seasonStats[left.name.toLowerCase()]?.ptsPerGame;
      const rightFpg = seasonStats[right.name.toLowerCase()]?.ptsPerGame;
      if (!isFiniteNumber(leftFpg) || !isFiniteNumber(rightFpg)) return compareNullableNumbers(leftFpg, rightFpg);
      comparison = compareNullableNumbers(leftFpg, rightFpg);
    } else if (key === "pos") {
      comparison = POSITION_ORDER[left.pos] - POSITION_ORDER[right.pos];
    } else if (key === "team") {
      comparison = left.nflTeam.localeCompare(right.nflTeam);
    } else {
      comparison = left.name.localeCompare(right.name);
    }

    if (comparison === 0) return left.name.localeCompare(right.name);
    return comparison * multiplier;
  });
}
