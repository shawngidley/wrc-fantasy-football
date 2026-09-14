import { describe, expect, it } from "vitest";
import { acquirePlayerInfoSlot, releasePlayerInfoSlot } from "./useTank01Player";

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
