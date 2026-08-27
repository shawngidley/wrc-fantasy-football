import { describe, expect, it } from "vitest";
import { isSamePlayerName, normalizePlayerName } from "./playerNameMatch";

describe("normalizePlayerName", () => {
  it("matches a name against the same name with a generational suffix", () => {
    expect(normalizePlayerName("James Cook")).toBe(normalizePlayerName("James Cook III"));
    expect(isSamePlayerName("James Cook", "James Cook III")).toBe(true);
  });

  it("strips Jr, Sr, II, III, IV, and V suffixes", () => {
    expect(normalizePlayerName("Michael Pittman Jr.")).toBe(normalizePlayerName("Michael Pittman"));
    expect(normalizePlayerName("Odell Beckham Jr")).toBe(normalizePlayerName("Odell Beckham"));
    expect(normalizePlayerName("Marvin Harrison Sr.")).toBe(normalizePlayerName("Marvin Harrison"));
    // Both suffix variants collapse to the same base name, even though real
    // Marvin Harrison Sr. and Jr. are different people -- this module only
    // strips a single trailing suffix token, so "Marvin Harrison Sr." and
    // "Marvin Harrison II" both normalize to "marvinharrison". WRC's own
    // roster/API data doesn't currently have this specific collision; if it
    // ever does, it needs a NAME_ALIASES-style exception, not a suffix fix.
    expect(normalizePlayerName("Marvin Harrison Sr.")).toBe(normalizePlayerName("Marvin Harrison II"));
  });

  it("does not strip a suffix if it's the player's entire name", () => {
    expect(normalizePlayerName("V")).toBe("v");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(normalizePlayerName("A.J. Brown")).toBe(normalizePlayerName("AJ Brown"));
    expect(normalizePlayerName("aj brown")).toBe(normalizePlayerName("AJ BROWN"));
  });

  it("applies known aliases that aren't simple suffix differences", () => {
    expect(isSamePlayerName("Kenneth Gainwell", "Kenny Gainwell")).toBe(true);
  });

  it("does not collapse genuinely different players", () => {
    expect(isSamePlayerName("James Cook", "James Cooke")).toBe(false);
    expect(isSamePlayerName("Josh Allen", "Josh Allen")).toBe(true);
  });
});
