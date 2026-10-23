import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLineupAutosaver, type AutosaveStatus } from "./lineupAutosaver";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup(saveImpl?: (rows: string) => Promise<boolean>) {
  const saved: string[] = [];
  const statuses: AutosaveStatus[] = [];
  const save = vi.fn(async (rows: string) => { saved.push(rows); return saveImpl ? saveImpl(rows) : true; });
  const saver = createLineupAutosaver<string>({ delayMs: 1500, save, onStatus: s => statuses.push(s), key: r => r });
  return { saver, save, saved, statuses };
}

describe("createLineupAutosaver", () => {
  it("waits for the pause, then saves once with the latest lineup", async () => {
    const { saver, saved } = setup();
    saver.schedule("A");
    saver.schedule("B");
    saver.schedule("C");
    await vi.advanceTimersByTimeAsync(1499);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(saved).toEqual(["C"]);
  });

  it("reports pending, saving, saved", async () => {
    const { saver, statuses } = setup();
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    expect(statuses).toEqual(["pending", "saving", "saved"]);
  });

  it("does not save when the lineup matches what was last saved", async () => {
    const { saver, save } = setup();
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("queues an edit made during a save and sends it after, never out of order", async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    let first = true;
    const { saver, saved } = setup(async () => { if (first) { first = false; await gate; } return true; });
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600); // A is now in flight
    saver.schedule("B");
    await vi.advanceTimersByTimeAsync(1600); // B's timer fires while A still saving
    expect(saved).toEqual(["A"]);
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(saved).toEqual(["A", "B"]);
  });

  it("saveNow saves immediately even if nothing changed, and resolves with the result", async () => {
    const { saver, save } = setup();
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    const ok = await saver.saveNow("A");
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("saveNow cancels a pending autosave and sends the newer rows", async () => {
    const { saver, saved } = setup();
    saver.schedule("A");
    await saver.saveNow("B");
    await vi.advanceTimersByTimeAsync(3000);
    expect(saved).toEqual(["B"]);
  });

  it("reports an error and retries the failed rows", async () => {
    let fail = true;
    const { saver, saved, statuses } = setup(async () => !fail);
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    expect(statuses.at(-1)).toBe("error");
    fail = false;
    expect(await saver.retry()).toBe(true);
    expect(saved).toEqual(["A", "A"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("flush sends a waiting edit right away", async () => {
    const { saver, saved } = setup();
    saver.schedule("A");
    saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual(["A"]);
    expect(saver.isBusy()).toBe(false);
  });

  it("is busy from the first edit until the save finishes", async () => {
    const { saver } = setup();
    expect(saver.isBusy()).toBe(false);
    saver.schedule("A");
    expect(saver.isBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(saver.isBusy()).toBe(false);
  });

  // retry() is handed straight to onClick in the Lineup page's error state, so
  // it has to work detached from the object rather than relying on `this`.
  it("retry works when passed as a bare callback", async () => {
    let fail = true;
    const { saver, saved } = setup(async () => !fail);
    saver.schedule("A");
    await vi.advanceTimersByTimeAsync(1600);
    fail = false;
    const retry = saver.retry;
    expect(await retry()).toBe(true);
    expect(saved).toEqual(["A", "A"]);
  });
});
