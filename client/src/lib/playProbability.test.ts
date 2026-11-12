import { describe, expect, it } from "vitest";
import { formatPlayChance, isNotPlayingStatus } from "./playProbability";

describe("formatPlayChance", () => {
  it("turns FantasyPros fractions into whole percents", () => {
    expect(formatPlayChance(0.97941, "Q")).toBe("98% chance to play");
    expect(formatPlayChance(0.92297, "Q")).toBe("92% chance to play");
    expect(formatPlayChance(0.5, "D")).toBe("50% chance to play");
  });

  it("keeps a real 0% for a player who is not ruled out", () => {
    expect(formatPlayChance(0, "D")).toBe("0% chance to play");
  });

  it("shows the line for a player the feed lists with no designation at all", () => {
    // Wed/Thu the feed carries a practice injury type and a play probability
    // with a blank status -- that is the case the line is most useful for, so a
    // blank status must not be treated as "not playing".
    expect(formatPlayChance(0.84, "")).toBe("84% chance to play");
    expect(formatPlayChance(0.84, null)).toBe("84% chance to play");
  });

  it("tolerates a value already on a 0-100 scale", () => {
    expect(formatPlayChance(75, "Q")).toBe("75% chance to play");
    expect(formatPlayChance(150, "Q")).toBe("100% chance to play");
  });

  // The single input the fraction and percent readings disagree on. Pinned so
  // the choice stays a decision rather than an accident: the live feed is
  // fractional, so 1 means certain to play.
  it("reads exactly 1 as 100%, the live fractional feed's meaning", () => {
    expect(formatPlayChance(1, "Q")).toBe("100% chance to play");
  });

  it("rounds a sliver of a chance down to 0% rather than hiding the line", () => {
    expect(formatPlayChance(0.004, "D")).toBe("0% chance to play");
  });

  it("hides the line for a missing or nonsensical value", () => {
    expect(formatPlayChance(null, "Q")).toBe("");
    expect(formatPlayChance(undefined, "Q")).toBe("");
    expect(formatPlayChance(Number.NaN, "Q")).toBe("");
    expect(formatPlayChance(-0.5, "Q")).toBe("");
  });

  it("hides the line for every status that already means the player is not playing", () => {
    // IR and Out are the obvious two, but the site's own injury vocabulary
    // (useNFLInjuries' getInjuryColor red bucket plus getInjuryLabel) treats
    // PUP, DNR, suspension and NFI the same way -- "0% chance to play" beside
    // any of them is noise.
    for (const status of ["IR", "Out", "O", "Injured Reserve", "PUP", "DNR", "NFI", "Suspension", "Suspended"]) {
      expect(formatPlayChance(0, status)).toBe("");
    }
  });

  it("hides the line for qualified never-playing statuses", () => {
    expect(formatPlayChance(0, "Injured Reserve - Designated to Return")).toBe("");
    expect(formatPlayChance(0, "Out (hamstring)")).toBe("");
    expect(formatPlayChance(0, "Suspended 4 games")).toBe("");
  });
});

describe("isNotPlayingStatus", () => {
  it("leaves the week's playable designations alone", () => {
    for (const status of ["Q", "Questionable", "D", "Doubtful", "P", "Probable", "Limited", "LTD", ""]) {
      expect(isNotPlayingStatus(status)).toBe(false);
    }
  });

  it("does not mistake a practice note that merely mentions being out", () => {
    // A ruling is a status, not prose. Anchoring matters because this value is
    // `shortStatus || status` and the feed's status field has carried free
    // text.
    expect(isNotPlayingStatus("Limited, ruled out of Wednesday's session")).toBe(false);
  });
});
