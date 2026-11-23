import { describe, expect, it } from "vitest";
import { rosterRoundBadge } from "./rosterRoundLabel";

describe("rosterRoundBadge", () => {
  // The reported bug, with David Montgomery's real row: protected at round 6 by
  // David S., cut on 2026-11-12, picked up by Scott N. His protections row
  // still exists and still says 6.
  it("shows FA for a protected player who was cut and picked back up", () => {
    expect(rosterRoundBadge("FA", null, 6)).toEqual({ label: "FA", isProtected: false, isFreeAgent: true });
  });

  // The other live case: Brian Thomas Jr., protected at 5 by Greg, cut
  // 2026-10-25 and still on no roster.
  it("shows FA for a protected player who was cut and never picked up", () => {
    expect(rosterRoundBadge("FA", null, 5).label).toBe("FA");
  });

  // Traded, not cut: the protection travels with the player and the new team
  // carries the cost. Malik Nabers, Puka Nacua, Matthew Stafford, Harold Fannin.
  it("keeps the protected round for a protected player who was traded", () => {
    expect(rosterRoundBadge("Protected (Rd 6)", null, 6)).toEqual({ label: "Rd 6", isProtected: true, isFreeAgent: false });
  });

  it("keeps the protected round for a player still on the team that protected him", () => {
    expect(rosterRoundBadge("Protected (Rd 2)", 2, 2).label).toBe("Rd 2");
  });

  // Pre-existing behaviour this must not regress: a stale draft_round left on
  // the row of someone later picked up off waivers still reads FA.
  it("shows FA for a drafted player later picked up as a free agent", () => {
    expect(rosterRoundBadge("FA", 4, null)).toEqual({ label: "FA", isProtected: false, isFreeAgent: true });
  });

  it("shows the draft round for an ordinary drafted player", () => {
    expect(rosterRoundBadge("Draft", 9, null)).toEqual({ label: "Rd 9", isProtected: false, isFreeAgent: false });
  });

  it("shows FA for an undrafted, unprotected player", () => {
    expect(rosterRoundBadge("FA", null, null).label).toBe("FA");
    expect(rosterRoundBadge(null, null, null).label).toBe("FA");
  });

  // A protection is only ever styled as one when it actually applies, or the
  // cut player keeps the gold protected pill while reading "FA".
  it("never reports a cut player as protected", () => {
    expect(rosterRoundBadge("FA", null, 6).isProtected).toBe(false);
  });
});
