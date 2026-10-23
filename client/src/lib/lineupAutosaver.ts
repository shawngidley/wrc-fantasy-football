/**
 * Debounced, single flight saver for the Lineup page.
 *
 * - schedule(rows): an owner edit. Waits delayMs after the last edit, then
 *   saves. Skips the save if the rows match what was last saved.
 * - saveNow(rows): the Save button or the optimizer. Saves right away, even
 *   if nothing changed, and resolves with whether that save worked.
 * - Only one save runs at a time. An edit that arrives mid save is queued and
 *   sent after it, so an older save can never land on top of a newer one.
 * - flush(): send a pending edit now (used when the tab is hidden or the page
 *   closes).
 */
export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface LineupAutosaver<R> {
  schedule(rows: R): void;
  saveNow(rows: R): Promise<boolean>;
  flush(): void;
  retry(): Promise<boolean>;
  /** True while an edit is waiting, a save is running, or one is queued. */
  isBusy(): boolean;
  cancel(): void;
}

export function createLineupAutosaver<R>(opts: {
  delayMs: number;
  save: (rows: R) => Promise<boolean>;
  onStatus?: (status: AutosaveStatus) => void;
  key?: (rows: R) => string;
}): LineupAutosaver<R> {
  const key = opts.key ?? ((rows: R) => JSON.stringify(rows));
  let latest: R | null = null;
  let latestForce = false;
  let failedRows: R | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let waiters: Array<(ok: boolean) => void> = [];
  let lastSavedKey: string | null = null;
  const status = (s: AutosaveStatus) => opts.onStatus?.(s);

  async function run(): Promise<void> {
    if (inFlight || latest === null) return;
    const rows = latest;
    const force = latestForce;
    const mine = waiters;
    latest = null;
    latestForce = false;
    waiters = [];

    if (!force && lastSavedKey !== null && key(rows) === lastSavedKey) {
      mine.forEach(w => w(true));
      if (latest === null && timer === undefined) status("saved");
      return;
    }

    inFlight = true;
    status("saving");
    let ok = false;
    try {
      ok = await opts.save(rows);
    } catch {
      ok = false;
    }
    inFlight = false;
    if (ok) { lastSavedKey = key(rows); failedRows = null; } else failedRows = rows;
    mine.forEach(w => w(ok));

    if (latest !== null) {
      // A newer edit arrived while saving. If its timer is still running it
      // will fire on its own; otherwise send it now.
      if (timer === undefined) void run();
      else status("pending");
      return;
    }
    status(ok ? "saved" : "error");
  }

  function arm() {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void run(); }, opts.delayMs);
  }

  function saveNow(rows: R): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      latest = rows;
      latestForce = true;
      waiters.push(resolve);
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
      void run();
    });
  }

  return {
    schedule(rows) {
      latest = rows;
      status("pending");
      arm();
    },
    saveNow,
    flush() {
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
      void run();
    },
    // Calls saveNow directly rather than through `this`, so the method keeps
    // working when it is passed as a callback (onClick={autosaver.retry}).
    retry() {
      return failedRows === null ? Promise.resolve(true) : saveNow(failedRows);
    },
    isBusy() {
      return timer !== undefined || inFlight || latest !== null;
    },
    cancel() {
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
      latest = null;
      latestForce = false;
    },
  };
}
