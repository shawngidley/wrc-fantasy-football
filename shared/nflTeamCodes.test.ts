import { describe, expect, it } from "vitest";
import { normalizeNFLTeamCode } from "./nflTeamCodes";

describe("normalizeNFLTeamCode", () => {
  it("uses JAC as the canonical Jaguars code", () => {
    expect(normalizeNFLTeamCode("JAX")).toBe("JAC");
    expect(normalizeNFLTeamCode("jac")).toBe("JAC");
  });

  it("normalizes the other upstream abbreviation variants", () => {
    expect(normalizeNFLTeamCode("KAN")).toBe("KC");
    expect(normalizeNFLTeamCode("WAS")).toBe("WSH");
  });

  it("uses LAR as the canonical Rams code, since nflverse's roster data uses bare LA", () => {
    expect(normalizeNFLTeamCode("LA")).toBe("LAR");
    // Confirm the Chargers' distinct code is left untouched -- LA is
    // ambiguous between the two LA teams in principle, but nflverse
    // consistently uses LAC for the Chargers, never bare LA.
    expect(normalizeNFLTeamCode("LAC")).toBe("LAC");
  });

  it("uses ARI as the canonical Cardinals code, covering both the AZ and ARZ variants", () => {
    // Reported by a user: Jeremiyah Love and Trey McBride (both Cardinals)
    // were showing an incorrect bye week, traced to a data source using
    // the bare 2-letter "AZ" -- distinct from the 3-letter "ARZ" variant
    // already covered.
    expect(normalizeNFLTeamCode("AZ")).toBe("ARI");
    expect(normalizeNFLTeamCode("ARZ")).toBe("ARI");
  });
});
