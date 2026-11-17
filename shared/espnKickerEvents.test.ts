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

  // Confirmed live via server-side finalization logs: Eddy Pineiro made
  // a 20-yard and a 56-yard FG (7.6 pts) plus 3/3 XP (+3), for a real
  // total of 10.6 -- the previous Tank01-only server-side fallback
  // (no per-kick distance data, only an aggregate fgYds field that came
  // back empty) computed just 1.0 for this exact game, silently
  // dropping all FG credit. This is the scenario that motivated fetching
  // ESPN's play-by-play server-side instead of relying on Tank01 alone.
  it("reproduces the exact live Eddy Pineiro scenario: two made FGs plus 3/3 XP", () => {
    const events = [
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 20, text: "20 yard field goal is GOOD" },
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 56, text: "56 yard field goal is GOOD" },
    ];
    const rawStats = { Kicking: { xpMade: 3, xpAttempts: 3 } };
    expect(calculateWrcKickerPoints(events, rawStats)).toBe(10.6);
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

describe("repeated identical kicks", () => {
  // Real play text from SF @ DAL on 2026-11-15, where Brandon Aubrey made two
  // 52-yard field goals with the same center and holder. ESPN's text for the
  // two kicks is byte-identical, which is what the old text-only dedup key
  // collapsed into a single event.
  const fg = "B.Aubrey 52 yard field goal is GOOD, Center-T.Sieg, Holder-B.Anger.";

  it("keeps both of two identical 52-yard field goals (no ids)", () => {
    const events = parseEspnKickerEvents({ drives: { previous: [
      { plays: [{ type: { text: "Field Goal Good" }, text: fg }] },
      { plays: [{ type: { text: "Field Goal Good" }, text: fg }] },
    ] } });
    expect(events.filter(e => e.type === "fg")).toHaveLength(2);
    expect(calculateWrcKickerPoints(events)).toBe(10.4);
  });

  it("keeps both kicks when ESPN gives each play an id", () => {
    const events = parseEspnKickerEvents({ drives: { previous: [{ plays: [
      { id: "1", type: { text: "Field Goal Good" }, text: fg },
      { id: "2", type: { text: "Field Goal Good" }, text: fg },
    ] }] } });
    expect(events).toHaveLength(2);
  });

  // The shape the live endpoint actually returns, verified against
  // summary?event=401873065 on 2026-11-16: no top-level `plays` array at all,
  // and every drive play carrying its own id. This is the production path, so
  // the points below are what official finalization now records.
  it("scores the real SF @ DAL payload shape: two 52-yard makes, not one", () => {
    const events = parseEspnKickerEvents({ drives: { previous: [
      { plays: [
        { id: "401873063455", type: { text: "Field Goal Good" }, text: fg },
        { id: "401873063460", type: { text: "Punt" }, text: "B.Anger punts 44 yards to SF 20." },
      ] },
      { plays: [{ id: "401873063881", type: { text: "Field Goal Good" }, text: fg }] },
    ] } });
    expect(getKickerEventsForPlayer(events, "Brandon Aubrey")).toHaveLength(2);
    // 52 * 0.1 twice. The old parser returned 5.2 -- a whole kick's worth of
    // points missing from a finalized week.
    expect(calculateWrcKickerPoints(events)).toBe(10.4);
  });

  it("still drops a play listed in both plays and drives", () => {
    const play = { id: "9", type: { text: "Field Goal Good" }, text: fg };
    const events = parseEspnKickerEvents({ plays: [play], drives: { previous: [{ plays: [play] }] } });
    expect(events).toHaveLength(1);
  });

  it("still drops an id-less play listed in both lists", () => {
    const play = { type: { text: "Field Goal Good" }, text: fg };
    const events = parseEspnKickerEvents({ plays: [play, play], drives: { previous: [{ plays: [play, play] }] } });
    expect(events).toHaveLength(2);
  });

  // Counting repeats per list, rather than across the concatenation, is what
  // makes the line above work. If one list holds fewer copies than the other,
  // the answer must be the larger count, not the sum and not the smaller.
  it("takes the larger count when the two lists disagree about how many copies there are", () => {
    const play = { type: { text: "Field Goal Good" }, text: fg };
    const events = parseEspnKickerEvents({ plays: [play], drives: { previous: [{ plays: [play, play] }] } });
    expect(events).toHaveLength(2);
  });

  it("tags every parsed event with a playKey so callers can dedupe across games", () => {
    const events = parseEspnKickerEvents({ drives: { previous: [{ plays: [
      { id: "1", type: { text: "Field Goal Good" }, text: fg },
      { id: "2", type: { text: "Field Goal Good" }, text: fg },
    ] }] } });
    expect(events.map(e => e.playKey)).toEqual(["id:1", "id:2"]);
  });
});
