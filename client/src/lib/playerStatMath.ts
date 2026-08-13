export function calculateStatAverage(total: number | undefined, attempts: number | undefined): number {
  const safeTotal = total ?? 0;
  const safeAttempts = attempts ?? 0;
  return safeAttempts > 0 ? Math.round((safeTotal / safeAttempts) * 10) / 10 : 0;
}
