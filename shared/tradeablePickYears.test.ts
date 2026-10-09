import { describe, expect, it } from "vitest";
import { TRADEABLE_PICK_YEARS, DEFAULT_TRADEABLE_PICK_YEAR, isTradeablePickYear } from "./tradeablePickYears";

describe("tradeable pick years", () => {
  it("excludes the completed 2026 draft", () => {
    expect(isTradeablePickYear(2026)).toBe(false);
    expect(TRADEABLE_PICK_YEARS).not.toContain(2026);
  });

  it("allows the 2027 draft", () => {
    expect(isTradeablePickYear(2027)).toBe(true);
  });

  it("rejects anything outside the list", () => {
    expect(isTradeablePickYear(2025)).toBe(false);
    expect(isTradeablePickYear(2028)).toBe(false);
  });

  // The picker opens on this year and only renders picks matching it, so a
  // default outside the tradeable set shows an empty list on a team that does
  // own tradeable picks.
  it("opens the picker on a year that is actually tradeable", () => {
    expect(isTradeablePickYear(DEFAULT_TRADEABLE_PICK_YEAR)).toBe(true);
  });
});
