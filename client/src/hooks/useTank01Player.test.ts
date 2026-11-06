import { describe, expect, it, vi } from "vitest";
import { acquirePlayerInfoSlot, fetchPlayerByName, pickPlayerForName, releasePlayerInfoSlot } from "./useTank01Player";
describe("Tank01 player-info concurrency limiter", () => {
  it("allows up to the concurrency limit (5) to acquire a slot immediately", async () => {
    const acquiredOrder: number[] = [];
    const acquisitions = [1, 2, 3, 4, 5].map(async i => {
      await acquirePlayerInfoSlot();
      acquiredOrder.push(i);
    });
    await Promise.all(acquisitions);
    // All 5 should have resolved without needing to wait on each other.
    expect(acquiredOrder.sort()).toEqual([1, 2, 3, 4, 5]);
    // Release all 5 to leave the module-level state clean for other tests.
    for (let i = 0; i < 5; i++) releasePlayerInfoSlot();
  });

  it("queues a 6th request until a slot is released", async () => {
    // Fill all 5 slots.
    for (let i = 0; i < 5; i++) await acquirePlayerInfoSlot();

    let sixthAcquired = false;
    const sixth = acquirePlayerInfoSlot().then(() => { sixthAcquired = true; });

    // Give any pending microtasks a chance to run -- the 6th should NOT
    // have acquired yet, since all 5 slots are still held.
    await Promise.resolve();
    await Promise.resolve();
    expect(sixthAcquired).toBe(false);

    // Release one slot -- the queued 6th should now be able to proceed.
    releasePlayerInfoSlot();
    await sixth;
    expect(sixthAcquired).toBe(true);

    // Clean up: release the remaining 4 original slots plus the 6th's slot.
    for (let i = 0; i < 5; i++) releasePlayerInfoSlot();
  });
});

describe("pickPlayerForName", () => {
  it("prefers the league's player when names collide", () => {
    const nyg = { playerID: "111" }, wsh = { playerID: "5081432" };
    expect(pickPlayerForName([nyg, wsh], "5081432")).toBe(wsh);
    expect(pickPlayerForName([nyg, wsh], null)).toBe(nyg);
  });
});

/**
 * The league's Antonio Williams is the one the draft universe names (WSH).
 * Tank01's name search also returns the journeyman RB who was on BUF in 2020
 * and NYG in 2022 -- the player the card was showing: his headshot, his NYG
 * matchup, and his 2020/2022 seasons in the career table. When the universe
 * knows the id, the name search must never run at all.
 */
describe("fetchPlayerByName for a player the draft universe knows", () => {
  it("asks for that exact id and never runs the name search", async () => {
    const urls: string[] = [];
    const fake = vi.fn(async (url: string) => {
      urls.push(String(url));
      return {
        ok: true,
        json: async () => ({ body: { playerID: "5081432", longName: "Antonio Williams", pos: "WR", team: "WSH", espnID: "5081432" } }),
      } as unknown as Response;
    });
    const original = globalThis.fetch;
    globalThis.fetch = fake as unknown as typeof fetch;
    try {
      const player = await fetchPlayerByName("Antonio Williams");
      expect(player?.playerID).toBe("5081432");
      expect(player?.team).toBe("WSH");
    } finally {
      globalThis.fetch = original;
    }
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("playerID=5081432");
    expect(urls.some(u => u.includes("playerName="))).toBe(false);
  });
});
