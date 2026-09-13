import { describe, expect, it } from "vitest";
import { calculateWrcKickerPoints, getKickerEventsForPlayer, parseEspnKickerEvents, groupKickerEventsForDisplay } from "./espnKickerEvents";

describe("ESPN kicker play parsing", () => {
  const summary = {
    drives: {
      previous: [{ plays: [
        { type: { text: "Field Goal Good" }, text: "B.Aubrey 54 yard field goal is GOOD, Center-T.Sieg." },
        { type: { text: "Field Goal Missed" }, text: "B.Aubrey 47 yard field goal is No Good." },
        { type: { text: "Extra Point Good" }, text: "B.Aubrey extra point is GOOD." },
      ] }],
    },
  };

  it("parses exact field-goal yards and matches an abbreviated ESPN kicker name", () => {
    const events = getKickerEventsForPlayer(parseEspnKickerEvents(summary), "Brandon Aubrey");
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "fg", outcome: "made", yards: 54 });
    expect(events[1]).toMatchObject({ type: "fg", outcome: "missed", yards: 47 });
  });

  it("scores a 54-yard make, short miss, and made extra point under WRC rules", () => {
    const events = getKickerEventsForPlayer(parseEspnKickerEvents(summary), "Brandon Aubrey");
    expect(calculateWrcKickerPoints(events)).toBe(4.4);
  });
});

describe("calculateWrcKickerPoints with rawStats (XP scoring)", () => {
  it("adds XP points from rawStats when the events array is missing the XP play entirely", () => {
    // Reproduces the exact bug found live: ESPN's play-by-play text for
    // this specific XP didn't match the parser's regex, so the events
    // array only ever contained the FG -- rawStats.Kicking.xpMade should
    // still correctly add the made XP's point.
    const fgOnlyEvents = [{ playerName: "A.Borregales", type: "fg" as const, outcome: "made" as const, yards: 50, text: "50 yard field goal is GOOD" }];
    const rawStats = { Kicking: { xpMade: 1, xpAttempts: 1 } };
    // 50yd FG = 50*0.1 = 5.0, plus 1 made XP = +1 -> 6.0 total
    expect(calculateWrcKickerPoints(fgOnlyEvents, rawStats)).toBe(6.0);
  });

  it("still scores FG-only points correctly when rawStats has no kicking data", () => {
    const fgOnlyEvents = [{ playerName: "A.Borregales", type: "fg" as const, outcome: "made" as const, yards: 50, text: "50 yard field goal is GOOD" }];
    expect(calculateWrcKickerPoints(fgOnlyEvents, {})).toBe(5.0);
  });

  it("correctly counts a missed XP as -2 via rawStats", () => {
    const noEvents: import("./espnKickerEvents").KickerPlayEvent[] = [];
    const rawStats = { Kicking: { xpMade: 1, xpAttempts: 2 } }; // 1 made, 1 missed
    // 1 made (+1) + 1 missed (-2) = -1
    expect(calculateWrcKickerPoints(noEvents, rawStats)).toBe(-1);
  });

  it("falls back to event-based XP scoring when rawStats has no Kicking data at all", () => {
    const events = [{ playerName: "A.Borregales", type: "xp" as const, outcome: "made" as const, yards: null, text: "extra point is GOOD" }];
    expect(calculateWrcKickerPoints(events, {})).toBe(1);
  });

  it("prefers rawStats XP data over the events array's XP data when both are present", () => {
    // If both sources somehow disagree, rawStats (the reliable, structured
    // source) should win rather than the fallible text-parsed one.
    const events = [{ playerName: "A.Borregales", type: "xp" as const, outcome: "missed" as const, yards: null, text: "extra point is NO GOOD" }];
    const rawStats = { Kicking: { xpMade: 1, xpAttempts: 1 } }; // rawStats says it was actually made
    expect(calculateWrcKickerPoints(events, rawStats)).toBe(1);
  });
});

describe("groupKickerEventsForDisplay", () => {
  it("combines multiple made FGs into one chip listing all yardages and their total points", () => {
    // Exact scenario from the E. Pineiro screenshot: 20yd made, 56yd
    // made, 52yd missed (not penalized since >49yd), 3/3 XP made.
    const events = [
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 20, text: "20 yard field goal is GOOD" },
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 56, text: "56 yard field goal is GOOD" },
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "missed" as const, yards: 52, text: "52 yard field goal is NO GOOD" },
    ];
    const chips = groupKickerEventsForDisplay(events);

    const madeChip = chips.find(c => c.key === "made-fgs-combined");
    expect(madeChip?.text).toBe("20, 56 yd FG made (+7.6)"); // 2.0 + 5.6

    const missedChip = chips.find(c => c.text.includes("missed"));
    expect(missedChip?.text).toBe("52 yd FG missed"); // no penalty shown, since 52 > 49
  });

  it("shows a single made FG the same as before (no comma-list needed for just one)", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 45, text: "45 yard field goal is GOOD" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips).toHaveLength(1);
    expect(chips[0].text).toBe("45 yd FG made (+4.5)");
  });

  it("includes the 60+ and 65+ yard bonuses in the combined total", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 62, text: "" }, // 6.2 + 1 bonus = 7.2
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 66, text: "" }, // 6.6 + 2 bonus = 8.6
    ];
    const chips = groupKickerEventsForDisplay(events);
    const madeChip = chips.find(c => c.key === "made-fgs-combined");
    expect(madeChip?.text).toBe("62, 66 yd FG made (+15.8)");
  });

  it("keeps XP events and missed FGs as separate, individual chips, not combined", () => {
    const events = [
      { playerName: "K", type: "xp" as const, outcome: "made" as const, yards: null, text: "" },
      { playerName: "K", type: "xp" as const, outcome: "missed" as const, yards: null, text: "" },
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 30, text: "" },
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 40, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    // 2 individual XP chips + 1 combined made-FG chip = 3 total
    expect(chips).toHaveLength(3);
    expect(chips.filter(c => c.text.includes("XP"))).toHaveLength(2);
  });

  it("returns no made-FG chip at all when there are no made FGs", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 45, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips.find(c => c.key === "made-fgs-combined")).toBeUndefined();
  });
});
