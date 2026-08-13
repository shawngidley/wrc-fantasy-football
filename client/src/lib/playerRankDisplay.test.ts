import { describe, expect, it } from "vitest";
import { getOverallEcrDisplay } from "./playerRankDisplay";

describe("getOverallEcrDisplay", () => {
  it("suppresses an overall ECR that duplicates the numeric position rank", () => {
    expect(getOverallEcrDisplay(50, "RB50")).toBe("—");
  });

  it("shows a distinct cross-position ECR and handles missing values", () => {
    expect(getOverallEcrDisplay(151, "RB50")).toBe("#151");
    expect(getOverallEcrDisplay(null, "RB50")).toBe("—");
  });
});
