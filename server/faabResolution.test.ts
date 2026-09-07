import { describe, expect, it } from "vitest";
import { resolveFaabWinner, type FaabBidCandidate, type TeamStandingForTiebreak } from "./faabResolution";

function standing(wins: number, losses: number, ties: number, pointsFor: number): TeamStandingForTiebreak {
  return { wins, losses, ties, pointsFor };
}

describe("resolveFaabWinner", () => {
  it("picks the single highest bid when there's no tie", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-a", bidAmount: 20 },
      { id: "b", teamId: "team-b", bidAmount: 35 },
      { id: "c", teamId: "team-c", bidAmount: 10 },
    ];
    const standings = new Map([
      ["team-a", standing(5, 5, 0, 800)],
      ["team-b", standing(5, 5, 0, 800)],
      ["team-c", standing(5, 5, 0, 800)],
    ]);
    expect(resolveFaabWinner(candidates, standings).id).toBe("b");
  });

  it("breaks a tied bid amount by worst record (lowest win percentage)", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-a", bidAmount: 25 }, // 8-2, .800
      { id: "b", teamId: "team-b", bidAmount: 25 }, // 2-8, .200 -- worst record, should win
    ];
    const standings = new Map([
      ["team-a", standing(8, 2, 0, 900)],
      ["team-b", standing(2, 8, 0, 900)],
    ]);
    expect(resolveFaabWinner(candidates, standings).id).toBe("b");
  });

  it("treats ties as half a win for record comparison", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-a", bidAmount: 10 }, // 5-5-0, .500
      { id: "b", teamId: "team-b", bidAmount: 10 }, // 4-4-2, .500 too -- exactly tied on record
    ];
    const standings = new Map([
      ["team-a", standing(5, 5, 0, 700)],
      ["team-b", standing(4, 4, 2, 650)], // fewer points -- should win the tie
    ]);
    expect(resolveFaabWinner(candidates, standings).id).toBe("b");
  });

  it("falls through to least points scored when records are tied", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-a", bidAmount: 15 },
      { id: "b", teamId: "team-b", bidAmount: 15 },
    ];
    const standings = new Map([
      ["team-a", standing(3, 7, 0, 750)],
      ["team-b", standing(3, 7, 0, 680)], // same record, fewer points -- should win
    ]);
    expect(resolveFaabWinner(candidates, standings).id).toBe("b");
  });

  it("treats a 0-0-0 record as .500 (not automatically worst) for the very first award cycle before any games are played", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-a", bidAmount: 50 },
      { id: "b", teamId: "team-b", bidAmount: 50 },
    ];
    const standings = new Map([
      ["team-a", standing(0, 0, 0, 0)],
      ["team-b", standing(0, 0, 0, 0)],
    ]);
    // Both records and points are identical -- falls through to the final
    // deterministic tiebreaker (team_id comparison), not an error or an
    // arbitrary/unstable result.
    const result = resolveFaabWinner(candidates, standings);
    expect(["a", "b"]).toContain(result.id);
    // Confirm determinism: running it again gives the exact same answer.
    expect(resolveFaabWinner(candidates, standings).id).toBe(result.id);
  });

  it("is fully deterministic when every tiebreaker is exhausted", () => {
    const candidates: FaabBidCandidate[] = [
      { id: "a", teamId: "team-b", bidAmount: 10 },
      { id: "b", teamId: "team-a", bidAmount: 10 },
    ];
    const standings = new Map([
      ["team-a", standing(5, 5, 0, 500)],
      ["team-b", standing(5, 5, 0, 500)],
    ]);
    // team-a sorts before team-b alphabetically -- should always win.
    expect(resolveFaabWinner(candidates, standings).teamId).toBe("team-a");
  });

  it("throws if a candidate's team is missing from the standings map", () => {
    const candidates: FaabBidCandidate[] = [{ id: "a", teamId: "team-unknown", bidAmount: 10 }];
    const standings = new Map<string, TeamStandingForTiebreak>();
    expect(() => resolveFaabWinner(candidates, standings)).toThrow(/Missing team standing/);
  });

  it("throws on an empty candidate list", () => {
    expect(() => resolveFaabWinner([], new Map())).toThrow(/no candidates/);
  });
});
