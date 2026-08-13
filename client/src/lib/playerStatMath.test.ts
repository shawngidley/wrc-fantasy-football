import { describe, expect, it } from "vitest";
import { calculateStatAverage } from "./playerStatMath";

describe("calculateStatAverage", () => {
  it("returns a one-decimal per-attempt average", () => {
    expect(calculateStatAverage(703, 196)).toBe(3.6);
    expect(calculateStatAverage(208, 24)).toBe(8.7);
  });

  it("returns zero when there are no attempts", () => {
    expect(calculateStatAverage(0, 0)).toBe(0);
  });
});
