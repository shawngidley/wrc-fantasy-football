import { describe, expect, it } from "vitest";
import { applyReturnTouchdownsToDefense, isSpecialTeamsReturnTouchdown, parseEspnReturnTouchdowns } from "./espnReturnTouchdowns";
import { calcFantasyPoints } from "./scoringEngine";

/**
 * Every field below is real: captured from ESPN's scoringPlays for the four
 * special-teams return touchdowns in 2026 weeks 1-11, which is all of them
 * across 161 completed games.
 */
const REAL_RETURN_TDS = [
  { week: 3, team: "MIN", type: "Punt Return Touchdown", text: "Myles Price 86 Yd Punt Return (Will Reichard Kick)" },
  { week: 6, team: "TEN", type: "Blocked Punt Touchdown", text: "Oluwafemi Oladejo 14 Yd return of blocked punt (J.Slye kick)" },
  { week: 8, team: "LV", type: "Kickoff Return Touchdown", text: "Dylan Laube 95 Yd Kickoff Return (Matt Gay Kick)" },
  { week: 11, team: "BAL", type: "Kickoff Return Touchdown", text: "Devontez Walker 86 Yd Kickoff Return (Riley Patterson Kick)" },
];

/** The other touchdown type.text values ESPN actually used in those weeks. */
const REAL_OTHER_TD_TYPES = [
  "Fumble Return Touchdown",       // Tank01 counts this in defTD
  "Interception Return Touchdown", // Tank01 counts this in defTD
  "Passing Touchdown",
  "Rushing Touchdown",
];

describe("isSpecialTeamsReturnTouchdown", () => {
  it("recognizes all four real 2026 special-teams return touchdowns", () => {
    for (const play of REAL_RETURN_TDS) {
      expect(isSpecialTeamsReturnTouchdown({ type: { text: play.type }, text: play.text }), play.type).toBe(true);
    }
  });

  // This is the double-counting guard, and these are the real strings ESPN
  // uses: Tank01's defTD already holds both, so counting them here would award
  // 12 points for one touchdown.
  it("ignores the defensive return touchdowns Tank01 already counts", () => {
    for (const type of REAL_OTHER_TD_TYPES) {
      expect(isSpecialTeamsReturnTouchdown({ type: { text: type }, text: "someone 20 Yd whatever" }), type).toBe(false);
    }
  });

  it("ignores scoring plays that are not touchdowns", () => {
    for (const play of [
      { type: { text: "Field Goal Good" }, text: "Riley Patterson 28 Yd Field Goal" },
      { type: { text: "Safety" }, text: "Bryce Young Sacked by Mike Green For 8 Yd Loss for Safety" },
    ]) {
      expect(isSpecialTeamsReturnTouchdown(play), play.type.text).toBe(false);
    }
  });

  // ESPN supplied a specific type on all four, so the text fallback is a safety
  // net rather than the live path -- but it has to work on the real wording,
  // including "return of blocked punt", which reads nothing like the others.
  it("falls back to the text when ESPN gives no play type", () => {
    for (const play of REAL_RETURN_TDS) {
      expect(isSpecialTeamsReturnTouchdown({ text: `${play.text} touchdown` }), play.text).toBe(true);
    }
  });
});

describe("parseEspnReturnTouchdowns", () => {
  // The real BAL @ CAR scoring summary: one kickoff return touchdown among
  // eleven other scoring plays, several of them ordinary touchdowns.
  const balGame = {
    scoringPlays: [
      { id: "401873068198", type: { text: "Safety" }, text: "Bryce Young Sacked by Mike Green For 8 Yd Loss for Safety", team: { abbreviation: "BAL" } },
      { id: "401873068335", type: { text: "Passing Touchdown" }, text: "Rashod Bateman 52 Yd pass from Jacoby Brissett", team: { abbreviation: "BAL" } },
      { id: "4018730681473", type: { text: "Kickoff Return Touchdown" }, text: REAL_RETURN_TDS[3].text, team: { abbreviation: "BAL" } },
      { id: "4018730682024", type: { text: "Rushing Touchdown" }, text: "Justice Hill 19 Yd Rush", team: { abbreviation: "BAL" } },
      { id: "4018730681435", type: { text: "Rushing Touchdown" }, text: "Chuba Hubbard 18 Yd Rush", team: { abbreviation: "CAR" } },
    ],
  };

  it("finds exactly the one return touchdown in a real game summary", () => {
    const counts = parseEspnReturnTouchdowns(balGame);
    expect(counts.get("BAL")).toBe(1);
    expect(counts.has("CAR")).toBe(false);
  });

  it("keeps two separate returns of the same length apart", () => {
    const counts = parseEspnReturnTouchdowns({ scoringPlays: [
      { id: "1", type: { text: "Kickoff Return Touchdown" }, text: "A Returner 86 Yd Kickoff Return", team: { abbreviation: "BAL" } },
      { id: "2", type: { text: "Kickoff Return Touchdown" }, text: "A Returner 86 Yd Kickoff Return", team: { abbreviation: "BAL" } },
    ] });
    expect(counts.get("BAL")).toBe(2);
  });

  it("does not count the same play id twice", () => {
    const play = { id: "9", type: { text: "Kickoff Return Touchdown" }, text: REAL_RETURN_TDS[2].text, team: { abbreviation: "LV" } };
    expect(parseEspnReturnTouchdowns({ scoringPlays: [play, play] }).get("LV")).toBe(1);
  });

  it("returns nothing for a summary with no scoring plays", () => {
    expect(parseEspnReturnTouchdowns({}).size).toBe(0);
  });
});

describe("applyReturnTouchdownsToDefense", () => {
  it("adds the return touchdown on top of what Tank01 reported", () => {
    expect(applyReturnTouchdownsToDefense({ defTD: "1", sacks: "3" }, 1).defensiveOrSpecialTeamsTds).toBe(2);
  });

  // The live hook re-runs this every poll over stat lines kept from earlier
  // polls, so a repeat has to recompute rather than accumulate.
  it("is idempotent across repeated polls", () => {
    const once = applyReturnTouchdownsToDefense({ defTD: "1" }, 1);
    const thrice = applyReturnTouchdownsToDefense(applyReturnTouchdownsToDefense(once, 1), 1);
    expect(thrice.defensiveOrSpecialTeamsTds).toBe(2);
  });

  it("leaves a provider line that already combines defense and special teams alone", () => {
    const line = { defTD: "1", defensiveOrSpecialTeamsTds: "2" };
    expect(applyReturnTouchdownsToDefense(line, 1)).toBe(line);
  });

  it("folds a defense's own returnTD into the baseline rather than losing it", () => {
    expect(applyReturnTouchdownsToDefense({ defTD: "1", returnTD: "1" }, 1).defensiveOrSpecialTeamsTds).toBe(3);
  });

  it("changes nothing when the team had no return touchdown", () => {
    expect(applyReturnTouchdownsToDefense({ defTD: "2" }, 0).defensiveOrSpecialTeamsTds).toBe(2);
  });

  // End to end through the real scorer: WRC's rules say +6 for a
  // "Defensive/ST Touchdown", once.
  it("is worth exactly 6 points to the defense under WRC scoring", () => {
    const base = { sacks: "2", defensiveInterceptions: "1", fumblesRecovered: "0", defTD: "0", safeties: "0" };
    const before = calcFantasyPoints({ Defense: base } as never, "DST");
    const after = calcFantasyPoints({ Defense: applyReturnTouchdownsToDefense(base, 1) } as never, "DST");
    expect(after - before).toBe(6);
  });
});
