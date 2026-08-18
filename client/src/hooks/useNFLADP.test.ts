import { describe, expect, it } from "vitest";
import { isCurrent2026AdpDate } from "./useNFLADP";

describe("Tank01 2026 ADP date validation", () => {
  it("accepts only explicitly dated 2026 ADP payloads", () => {
    expect(isCurrent2026AdpDate("20260818")).toBe(true);
    expect(isCurrent2026AdpDate("20250818")).toBe(false);
    expect(isCurrent2026AdpDate("2026-08-18")).toBe(false);
    expect(isCurrent2026AdpDate(undefined)).toBe(false);
  });
});
