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
