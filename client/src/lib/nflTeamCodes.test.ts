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
});
