import { describe, expect, it } from "vitest";
import { getRosterBriefingPreview } from "./rosterBriefing";

describe("getRosterBriefingPreview", () => {
  it("keeps a roster briefing diverse when one player has many current updates", () => {
    const items = [
      { playerName: "Alec Pierce", id: 1 }, { playerName: "Alec Pierce", id: 2 }, { playerName: "Alec Pierce", id: 3 },
      { playerName: "Trey McBride", id: 4 }, { playerName: "Trey McBride", id: 5 }, { playerName: "Trey McBride", id: 6 },
      { playerName: "Ricky Pearsall", id: 7 },
    ];
    expect(getRosterBriefingPreview(items, 8, 2).map(item => item.id)).toEqual([1, 2, 4, 5, 7]);
  });
});
