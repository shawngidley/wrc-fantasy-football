import { describe, expect, it } from "vitest";
import { getEspnHeadshotUrl } from "./playerHeadshot";

describe("getEspnHeadshotUrl", () => {
  it("builds an ESPN headshot URL only when an athlete ID is available", () => {
    expect(getEspnHeadshotUrl("3052587")).toBe("https://a.espncdn.com/i/headshots/nfl/players/full/3052587.png");
    expect(getEspnHeadshotUrl(undefined)).toBeNull();
  });
});
