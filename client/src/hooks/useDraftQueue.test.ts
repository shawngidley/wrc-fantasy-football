import { describe, expect, it } from "vitest";
import { appendDraftQueueItem, findDraftQueueItemByPlayerName, removeDraftQueueItem, type DraftQueueItem } from "./useDraftQueue";

const existing: DraftQueueItem = {
  id: 1,
  team_id: "team-shawn",
  player_name: "Existing Player",
  player_pos: "RB",
  player_nfl_team: "CLE",
  rank: 1,
  season: 2026,
};

const newlyQueued: DraftQueueItem = {
  id: 2,
  team_id: "team-shawn",
  player_name: "Fernando Mendoza",
  player_pos: "QB",
  player_nfl_team: "LV",
  rank: 2,
  season: 2026,
};

describe("draft queue shared-cache updates", () => {
  it("immediately appends a Draft Players selection to the Draft Order query state", () => {
    expect(appendDraftQueueItem([existing], newlyQueued)).toEqual([existing, newlyQueued]);
    expect(appendDraftQueueItem(undefined, newlyQueued)).toEqual([newlyQueued]);
  });

  it("immediately removes a queue entry from the shared Draft Order query state", () => {
    expect(removeDraftQueueItem([existing, newlyQueued], newlyQueued.id)).toEqual([existing]);
  });

  it("finds queue entries case-insensitively for a player-star toggle", () => {
    expect(findDraftQueueItemByPlayerName([existing, newlyQueued], "fernando mendoza")).toEqual(newlyQueued);
    expect(findDraftQueueItemByPlayerName([existing], "Missing Player")).toBeUndefined();
  });
});
