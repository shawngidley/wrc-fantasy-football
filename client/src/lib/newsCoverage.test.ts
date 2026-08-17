import { describe, expect, it } from "vitest";
import { filterNewsToRecentWindow } from "./newsCoverage";

describe("filterNewsToRecentWindow", () => {
  const now = Date.parse("2026-08-17T15:00:00.000Z");

  it("keeps a complete seven-day inclusive window and excludes older or invalid timestamps", () => {
    const result = filterNewsToRecentWindow([
      { id: "boundary", published: "2026-08-10T15:00:00.000Z" },
      { id: "recent", published: "2026-08-17T14:59:59.000Z" },
      { id: "old", published: "2026-08-10T14:59:59.000Z" },
      { id: "future", published: "2026-08-17T15:00:01.000Z" },
      { id: "invalid", published: "not-a-date" },
    ], now);

    expect(result.map(item => item.id)).toEqual(["boundary", "recent"]);
  });
});
