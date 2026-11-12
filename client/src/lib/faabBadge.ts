/**
 * Remaining-FAAB lookup for the roster cards.
 *
 * `teams.faab` is the raw balance: a pending bid is NOT deducted until the
 * award runs (server/scheduledFaabAward.ts subtracts it there), which is also
 * the number an owner sees on their own FAAB page (`league.faabBidRoster`
 * returns the same raw column). So the badge and the bid screen agree, and the
 * badge's tooltip says pending bids aren't counted.
 *
 * $0 is a real, meaningful balance -- a team that has spent its entire budget
 * still earns a "$0 FAAB" badge, and that is precisely the team whose balance
 * everyone else wants to see. Only a team with no row in the query result
 * yields null, which hides the badge. Hence the explicit found/not-found
 * branch rather than a falsy fallback: `hit?.faab || null` would turn a
 * genuine 0 into "unknown" and hide it.
 */
export type FaabTeamRow = { id: string; faab: number };

export function faabForTeam(rows: readonly FaabTeamRow[], teamId: string): number | null {
  const hit = rows.find(row => row.id === teamId);
  return hit ? hit.faab : null;
}
