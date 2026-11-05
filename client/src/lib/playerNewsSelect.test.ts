import { describe, expect, it } from "vitest";
import { selectPlayerNews } from "./playerNewsSelect";

const item = (id: number, playerName: string, published: string) => ({
  id, playerName, title: `t${id}`, published, link: `https://x/${id}`,
});
const isA = (n: string) => n === "Player A";

describe("selectPlayerNews", () => {
  const feed = [item(1, "Player A", "2026-11-04T10:00:00Z"), item(2, "Player B", "2026-11-04T11:00:00Z")];

  it("keeps the name-matched news when the id lookup comes back empty (the vanishing news bug)", () => {
    expect(selectPlayerNews([], feed, isA).map(i => i.id)).toEqual([1]);
  });

  it("keeps the name-matched news while the id lookup is still loading", () => {
    expect(selectPlayerNews(undefined, feed, isA).map(i => i.id)).toEqual([1]);
  });

  it("combines both lists without duplicates, newest first", () => {
    const byId = [item(1, "Player A", "2026-11-04T10:00:00Z"), item(3, "Player A", "2026-11-05T09:00:00Z")];
    expect(selectPlayerNews(byId, feed, isA).map(i => i.id)).toEqual([3, 1]);
  });

  it("shows nothing when neither source has the player", () => {
    expect(selectPlayerNews([], [item(2, "Player B", "2026-11-04T11:00:00Z")], isA)).toEqual([]);
  });

  // The id lookup returns the raw feed rows, which carry a player_id but no
  // name (server/routers.ts returns early for fpid, skipping the name
  // enrichment the league feed gets). Those items must still be kept -- they
  // are this player's news by construction -- and must not be filtered out by
  // the name predicate.
  it("keeps id-matched items whose playerName is blank", () => {
    const byId = [item(5, "", "2026-11-05T12:00:00Z")];
    expect(selectPlayerNews(byId, feed, isA).map(i => i.id)).toEqual([5, 1]);
  });

  // Both sources are the same table, so the same story can arrive twice with
  // the same id; the blank-named id copy wins because it is added first.
  it("dedupes the same story arriving from both sources", () => {
    const byId = [item(1, "", "2026-11-04T10:00:00Z")];
    const out = selectPlayerNews(byId, feed, isA);
    expect(out.map(i => i.id)).toEqual([1]);
    expect(out).toHaveLength(1);
  });
});
