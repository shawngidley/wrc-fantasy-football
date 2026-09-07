import { describe, expect, it } from "vitest";
import { getFreeAgentMarketState } from "./faabMarketState";

// September 13, 2026 is a Sunday; Sept 14 Mon; Sept 15 Tue; Sept 17 Thu;
// Sept 19 Sat. EDT (UTC-4) applies throughout this range.

describe("getFreeAgentMarketState", () => {
  it("is bidding on Sunday before 9am (continuation of the window since Thursday)", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-13T12:59:00Z"))).toBe("bidding"); // 8:59am ET
  });

  it("is open_waiver from 9am to just before 1pm on Sunday", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-13T13:00:00Z"))).toBe("open_waiver"); // 9:00am ET
    expect(getFreeAgentMarketState(new Date("2026-09-13T16:59:00Z"))).toBe("open_waiver"); // 12:59pm ET
  });

  it("is closed from 1pm Sunday onward", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-13T17:00:00Z"))).toBe("closed"); // 1:00pm ET
    expect(getFreeAgentMarketState(new Date("2026-09-13T23:00:00Z"))).toBe("closed"); // 7pm ET
  });

  it("is closed all day Monday", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-14T05:00:00Z"))).toBe("closed"); // 1am ET
    expect(getFreeAgentMarketState(new Date("2026-09-14T23:00:00Z"))).toBe("closed"); // 7pm ET
  });

  it("is closed on Tuesday before 9am, then switches to bidding at 9am", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-15T12:59:00Z"))).toBe("closed"); // 8:59am ET
    expect(getFreeAgentMarketState(new Date("2026-09-15T13:00:00Z"))).toBe("bidding"); // 9:00am ET
  });

  it("is bidding all day Wednesday, Thursday, Friday, Saturday", () => {
    expect(getFreeAgentMarketState(new Date("2026-09-16T18:00:00Z"))).toBe("bidding"); // Wed
    expect(getFreeAgentMarketState(new Date("2026-09-17T13:30:00Z"))).toBe("bidding"); // Thu, right after the 9am award
    expect(getFreeAgentMarketState(new Date("2026-09-18T18:00:00Z"))).toBe("bidding"); // Fri
    expect(getFreeAgentMarketState(new Date("2026-09-19T18:00:00Z"))).toBe("bidding"); // Sat
  });

  it("correctly handles the EST side of the DST transition", () => {
    // December 6, 2026 is a Sunday, after DST ends (Nov 1, 2026) -- 9am ET = 14:00 UTC.
    expect(getFreeAgentMarketState(new Date("2026-12-06T13:59:00Z"))).toBe("bidding"); // 8:59am ET
    expect(getFreeAgentMarketState(new Date("2026-12-06T14:00:00Z"))).toBe("open_waiver"); // 9:00am ET
    expect(getFreeAgentMarketState(new Date("2026-12-06T18:00:00Z"))).toBe("closed"); // 1:00pm ET
  });
});
