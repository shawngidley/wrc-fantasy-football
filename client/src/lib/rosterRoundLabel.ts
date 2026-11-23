/**
 * The RND badge on a roster row: what this player currently costs the team
 * that holds him.
 *
 * `acquisition` is the source of truth for HOW he is on this roster now, and
 * the drop path sets it to "FA" (clearing draft_round) when a player is cut.
 * A protection, by contrast, is a historical record: the protections row is
 * deliberately kept after a cut so the Draft Reveal and Draft Recap can still
 * show what each team protected and what it cost them, since the forfeited
 * pick was spent and is not refunded when the player is later released.
 *
 * So the protection applies only while the player is still held on protected
 * terms. Two cases it has to tell apart, both live in 2026:
 *
 *  - TRADED: acquisition stays "Protected (Rd N)" and the protection travels
 *    with the player, so the new team shows the protected round (Malik Nabers,
 *    Puka Nacua, Matthew Stafford, Harold Fannin).
 *  - CUT: acquisition becomes "FA", so the badge reads FA even though a
 *    protections row still exists (David Montgomery, cut and picked up by
 *    another team; Brian Thomas Jr., cut and still unrostered).
 *
 * Reading the protection first -- `protectedRound ?? draftRound` -- showed a
 * cut player his old protected round forever.
 */
export const FREE_AGENT_ACQUISITION = "FA";

export type RosterRoundBadge = {
  /** "Rd 6" or "FA". */
  label: string;
  /** Still held on protected terms, so the badge is styled as a protection. */
  isProtected: boolean;
  /** No round at all: a free agent pickup. */
  isFreeAgent: boolean;
};

export function rosterRoundBadge(
  acquisition: string | null | undefined,
  draftRound: number | null | undefined,
  protectedRound: number | null | undefined,
): RosterRoundBadge {
  const pickedUpAsFreeAgent = acquisition === FREE_AGENT_ACQUISITION;
  const effectiveProtectedRound = pickedUpAsFreeAgent ? null : protectedRound ?? null;
  const effectiveDraftRound = pickedUpAsFreeAgent ? null : draftRound ?? null;
  const round = effectiveProtectedRound ?? effectiveDraftRound;
  return {
    label: round ? `Rd ${round}` : "FA",
    isProtected: effectiveProtectedRound != null,
    isFreeAgent: !round,
  };
}
