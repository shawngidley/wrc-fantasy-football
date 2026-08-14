import { describe, expect, it } from "vitest";
import { validateProtectionSubmission } from "./protectionRules";

describe("validateProtectionSubmission", () => {
  const roster = [
    { id: "tier-one", draftRound: 6 },
    { id: "round-seven", draftRound: 7 },
    { id: "choice-one", draftRound: 8 },
    { id: "choice-two", draftRound: null },
  ];

  it("derives fixed costs and permits distinct open round assignments", () => {
    expect(validateProtectionSubmission([
      { playerId: "tier-one", assignedRound: null },
      { playerId: "choice-one", assignedRound: 7 },
      { playerId: "choice-two", assignedRound: 8 },
    ], roster)).toEqual([
      { playerId: "tier-one", tier: "tier1", forfeitedRound: 5 },
      { playerId: "choice-one", tier: "tier2", forfeitedRound: 7 },
      { playerId: "choice-two", tier: "tier2", forfeitedRound: 8 },
    ]);
  });

  it("rejects a round assignment consumed by a fixed round-seven protection", () => {
    expect(() => validateProtectionSubmission([
      { playerId: "round-seven", assignedRound: null },
      { playerId: "choice-one", assignedRound: 6 },
    ], roster)).toThrow("Round 6 is already consumed");
  });

  it("rejects a player outside the signed-in team roster", () => {
    expect(() => validateProtectionSubmission([
      { playerId: "other-team-player", assignedRound: 6 },
    ], roster)).toThrow("not on your roster");
  });
});
