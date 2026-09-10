import { describe, expect, it } from "vitest";
import { calculateWrcKickerPoints, getKickerEventsForPlayer, parseEspnKickerEvents } from "./espnKickerEvents";

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
