export type ProtectionRosterPlayer = {
  id: string;
  draftRound: number | null;
};

export type SubmittedProtectionSlot = {
  playerId: string;
  assignedRound: number | null;
};

export type ValidatedProtection = {
  playerId: string;
  tier: "tier1" | "tier2";
  forfeitedRound: number;
};

function protectionTier(draftRound: number | null): "ineligible" | "tier1" | "tier2" {
  if (draftRound === null) return "tier2";
  if (draftRound <= 2) return "ineligible";
  if (draftRound <= 6) return "tier1";
  return "tier2";
}

/**
 * Applies the WRC keeper rules on the server. Client round choices are advisory:
 * fixed costs are derived from the roster record, and every submitted player must
 * belong to the signed-in team roster supplied by the caller.
 */
export function validateProtectionSubmission(
  submitted: SubmittedProtectionSlot[],
  roster: ProtectionRosterPlayer[],
): ValidatedProtection[] {
  if (submitted.length > 3) throw new Error("A team may protect no more than three players.");
  if (new Set(submitted.map(slot => slot.playerId)).size !== submitted.length) {
    throw new Error("Each protected player may only be submitted once.");
  }

  let tier1Count = 0;
  const reservedRounds = new Set<number>();
  const choiceSlots: Array<{ playerId: string; assignedRound: number | null }> = [];
  const validated: ValidatedProtection[] = [];

  for (const slot of submitted) {
    const player = roster.find(candidate => candidate.id === slot.playerId);
    if (!player) throw new Error("A selected protection player is not on your roster.");
    const tier = protectionTier(player.draftRound);
    if (tier === "ineligible") throw new Error("Players drafted in rounds 1–2 cannot be protected.");

    if (tier === "tier1") {
      tier1Count += 1;
      if (tier1Count > 1) throw new Error("Only one player drafted in rounds 3–6 may be protected.");
      const forfeitedRound = Number(player.draftRound) - 1;
      validated.push({ playerId: slot.playerId, tier, forfeitedRound });
      if (forfeitedRound >= 6 && forfeitedRound <= 8) reservedRounds.add(forfeitedRound);
      continue;
    }

    if (player.draftRound === 7) {
      validated.push({ playerId: slot.playerId, tier, forfeitedRound: 6 });
      reservedRounds.add(6);
      continue;
    }

    choiceSlots.push(slot);
  }

  const usedChoiceRounds = new Set<number>();
  for (const slot of choiceSlots) {
    if (slot.assignedRound === null || ![6, 7, 8].includes(slot.assignedRound)) {
      throw new Error("Each eligible free-agent or round 8–18 protection must use round 6, 7, or 8.");
    }
    if (reservedRounds.has(slot.assignedRound) || usedChoiceRounds.has(slot.assignedRound)) {
      throw new Error(`Round ${slot.assignedRound} is already consumed by another protection.`);
    }
    usedChoiceRounds.add(slot.assignedRound);
    validated.push({ playerId: slot.playerId, tier: "tier2", forfeitedRound: slot.assignedRound });
  }

  return validated;
}
