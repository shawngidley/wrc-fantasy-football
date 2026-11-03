import { describe, expect, it } from "vitest";
import { formatMinutesLeft } from "./liveMinutes";

describe("formatMinutesLeft", () => {
  it("shows whole minutes", () => {
    expect(formatMinutesLeft(600)).toBe("600");
    expect(formatMinutesLeft(247.4)).toBe("247");
    expect(formatMinutesLeft(0.6)).toBe("1");
  });
  it("says Done once every starter's game is over", () => {
    expect(formatMinutesLeft(0)).toBe("Done");
    expect(formatMinutesLeft(0.4)).toBe("Done");
  });
  it("shows a dash when there is no number", () => {
    expect(formatMinutesLeft(undefined)).toBe("—");
    expect(formatMinutesLeft(null)).toBe("—");
    expect(formatMinutesLeft(Number.NaN)).toBe("—");
  });
  it("never shows a negative", () => {
    expect(formatMinutesLeft(-3)).toBe("Done");
  });
});
