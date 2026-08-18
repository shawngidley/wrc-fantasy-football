import { describe, expect, it } from "vitest";
import { isProtectionDeadlinePassed, WRC_PROTECTION_DEADLINE, WRC_PROTECTION_DEADLINE_DISPLAY } from "./protectionSchedule";

describe("2026 WRC protection deadline", () => {
  it("locks Wednesday August 26 at 9 PM Eastern", () => {
    expect(WRC_PROTECTION_DEADLINE.toISOString()).toBe("2026-08-27T01:00:00.000Z");
    expect(WRC_PROTECTION_DEADLINE_DISPLAY).toBe("Wednesday, August 26, 2026 · 9:00 PM ET");
    expect(isProtectionDeadlinePassed(WRC_PROTECTION_DEADLINE.getTime() - 1)).toBe(false);
    expect(isProtectionDeadlinePassed(WRC_PROTECTION_DEADLINE.getTime())).toBe(true);
  });
});
