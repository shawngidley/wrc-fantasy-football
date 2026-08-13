import { describe, expect, it } from "vitest";
import { getFantasyProsFeedState, retainLastSuccessfulItems } from "./fantasyProsFeedState";

describe("FantasyPros feed recovery state", () => {
  it("retains the last populated feed while a refresh has no fresh items yet", () => {
    expect(retainLastSuccessfulItems([], ["Kenneth Walker III"])).toEqual(["Kenneth Walker III"]);
    expect(retainLastSuccessfulItems(["Spencer Rattler"], ["Kenneth Walker III"])).toEqual(["Spencer Rattler"]);
  });

  it("distinguishes loading and unavailable states from a genuine empty feed", () => {
    expect(getFantasyProsFeedState({ itemCount: 0, isLoading: true, isError: false })).toBe("loading");
    expect(getFantasyProsFeedState({ itemCount: 0, isLoading: false, isError: true })).toBe("unavailable");
    expect(getFantasyProsFeedState({ itemCount: 0, isLoading: false, isError: false })).toBe("empty");
  });
});
