import { describe, expect, it } from "vitest";
import { WRC_DRAFT_DATE, WRC_DRAFT_DISPLAY } from "./draftSchedule";

describe("2026 WRC draft schedule", () => {
  it("targets Sunday August 30 at 6 PM Eastern", () => {
    expect(WRC_DRAFT_DATE.toISOString()).toBe("2026-08-30T22:00:00.000Z");
    expect(WRC_DRAFT_DISPLAY).toBe("Sun Aug 30, 2026 · 6:00 PM ET");
  });
});
