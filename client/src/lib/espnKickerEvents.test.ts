import { describe, expect, it } from "vitest";
import { groupKickerEventsForDisplay } from "./espnKickerEvents";

describe("groupKickerEventsForDisplay", () => {
  it("filters out a missed FG of 50+ yards entirely -- it costs no points and isn't listed at all", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 55, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips).toHaveLength(0);
  });

  it("filters out a missed 50-yard FG exactly (the boundary) but keeps a missed 49-yard FG", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 50, text: "" },
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 49, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips).toHaveLength(1);
    expect(chips[0].text).toBe("49 yd FG missed (-2)");
  });

  it("still styles a missed FG of 49 yards or less as 'missed' (red) -- it does cost points", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 45, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips[0].outcome).toBe("missed");
    expect(chips[0].text).toBe("45 yd FG missed (-2)");
  });

  it("combines multiple made FGs into one chip listing all yardages and their total points", () => {
    // Exact scenario from the E. Pineiro screenshot: 20yd made, 56yd
    // made, 52yd missed (filtered out entirely, since 50+ yard misses
    // cost no points and aren't listed), 3/3 XP made.
    const events = [
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 20, text: "20 yard field goal is GOOD" },
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "made" as const, yards: 56, text: "56 yard field goal is GOOD" },
      { playerName: "E.Pineiro", type: "fg" as const, outcome: "missed" as const, yards: 52, text: "52 yard field goal is NO GOOD" },
    ];
    const chips = groupKickerEventsForDisplay(events);

    const madeChip = chips.find(c => c.key === "made-fgs-combined");
    expect(madeChip?.text).toBe("20, 56 yd FG made (+7.6)"); // 2.0 + 5.6

    expect(chips.find(c => c.text.includes("missed"))).toBeUndefined();
    expect(chips).toHaveLength(1); // only the combined made-FG chip
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

  it("drops XP events entirely, keeping only FG chips", () => {
    const events = [
      { playerName: "K", type: "xp" as const, outcome: "made" as const, yards: null, text: "" },
      { playerName: "K", type: "xp" as const, outcome: "missed" as const, yards: null, text: "" },
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 30, text: "" },
      { playerName: "K", type: "fg" as const, outcome: "made" as const, yards: 40, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    // No XP chips at all; the two made FGs combine into one chip.
    expect(chips.filter(c => c.text.includes("XP"))).toHaveLength(0);
    expect(chips).toHaveLength(1);
    expect(chips.find(c => c.key === "made-fgs-combined")).toBeDefined();
  });

  it("returns no made-FG chip at all when there are no made FGs", () => {
    const events = [
      { playerName: "K", type: "fg" as const, outcome: "missed" as const, yards: 45, text: "" },
    ];
    const chips = groupKickerEventsForDisplay(events);
    expect(chips.find(c => c.key === "made-fgs-combined")).toBeUndefined();
  });
});
