import { describe, expect, it } from "vitest";
import { getVisiblePlayerNews } from "./playerNewsDisplay";

describe("getVisiblePlayerNews", () => {
  it("shows the newest three updates until the owner expands the history", () => {
    const news = ["newest", "second", "third", "fourth", "fifth"];

    expect(getVisiblePlayerNews(news, false)).toEqual(["newest", "second", "third"]);
    expect(getVisiblePlayerNews(news, true)).toEqual(news);
  });
});
