export function getOverallEcrDisplay(ecr: number | null | undefined, positionRank: string | null | undefined): string {
  if (ecr == null) return "—";

  const positionRankNumber = Number(positionRank?.match(/\d+$/)?.[0]);
  if (Number.isFinite(positionRankNumber) && ecr === positionRankNumber) return "—";

  return `#${ecr}`;
}
