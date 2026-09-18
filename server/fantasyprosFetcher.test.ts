import { describe, expect, it } from "vitest";
import {
  CIRCUIT_BREAKER_PAUSE_MS,
  injuriesThresholdMs,
  isCircuitBreakerPaused,
  isDue,
  isLikelyNflGameWindow,
  newsThresholdMs,
  nextCircuitBreakerPausedUntil,
  nyDateString,
  RANKINGS_PROJECTIONS_THRESHOLD_MS,
  shouldSkipForBudget,
} from "./fantasyprosFetcher";

describe("isLikelyNflGameWindow", () => {
  // September 6, 2026 is a Sunday; September 7 is a Monday; September 3 is
  // a Thursday. EDT is UTC-4 during the NFL season (through early
  // November), so e.g. 1pm ET = 17:00 UTC.
  it("is true during the Sunday early-game window", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-06T17:00:00Z"))).toBe(true); // 1pm ET
  });

  it("is true late Sunday night (SNF)", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-06T23:30:00Z"))).toBe(true); // 7:30pm ET
  });

  it("is false early Sunday morning, before the inactives window", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-06T13:00:00Z"))).toBe(false); // 9am ET
  });

  it("is true during Thursday Night Football", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-03T23:15:00Z"))).toBe(true); // 7:15pm ET, Thursday
  });

  it("is false on Thursday before the TNF window", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-03T15:00:00Z"))).toBe(false); // 11am ET, Thursday
  });

  it("is true during Monday Night Football", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-08T00:00:00Z"))).toBe(true); // 8pm ET, Monday
  });

  it("is false on a non-game day (Wednesday) regardless of time", () => {
    expect(isLikelyNflGameWindow(new Date("2026-09-09T20:00:00Z"))).toBe(false); // 4pm ET, Wednesday
  });
});

describe("isDue", () => {
  const now = new Date("2026-09-14T12:00:00Z").getTime();

  it("is due when there is no prior fetch at all", () => {
    expect(isDue(null, 30 * 60_000, now)).toBe(true);
    expect(isDue(undefined, 30 * 60_000, now)).toBe(true);
  });

  it("is due when the stored timestamp doesn't parse", () => {
    expect(isDue("not-a-date", 30 * 60_000, now)).toBe(true);
  });

  it("is not due when fetched more recently than the threshold", () => {
    const fetchedAt = new Date(now - 10 * 60_000).toISOString(); // 10 min ago
    expect(isDue(fetchedAt, 30 * 60_000, now)).toBe(false);
  });

  it("is due exactly at the threshold boundary", () => {
    const fetchedAt = new Date(now - 30 * 60_000).toISOString(); // exactly 30 min ago
    expect(isDue(fetchedAt, 30 * 60_000, now)).toBe(true);
  });

  it("is due when fetched further back than the threshold", () => {
    const fetchedAt = new Date(now - 45 * 60_000).toISOString();
    expect(isDue(fetchedAt, 30 * 60_000, now)).toBe(true);
  });
});

describe("newsThresholdMs / injuriesThresholdMs / RANKINGS_PROJECTIONS_THRESHOLD_MS", () => {
  it("news and injuries speed up to 15 min in a game window, 30 min / 2 hours otherwise", () => {
    expect(newsThresholdMs(true)).toBe(15 * 60_000);
    expect(newsThresholdMs(false)).toBe(30 * 60_000);
    expect(injuriesThresholdMs(true)).toBe(15 * 60_000);
    expect(injuriesThresholdMs(false)).toBe(2 * 60 * 60_000);
  });

  it("rankings and projections use a fixed 8 hour cadence regardless of game window", () => {
    expect(RANKINGS_PROJECTIONS_THRESHOLD_MS).toBe(8 * 60 * 60_000);
  });
});

describe("shouldSkipForBudget", () => {
  it("never skips below 450 calls", () => {
    expect(shouldSkipForBudget("news", 0, false)).toEqual({ skip: false });
    expect(shouldSkipForBudget("ranks", 449, false)).toEqual({ skip: false });
    expect(shouldSkipForBudget("projections", 449, true)).toEqual({ skip: false });
  });

  it("pauses rankings and projections at 450+, but not news or injuries", () => {
    expect(shouldSkipForBudget("ranks", 450, false).skip).toBe(true);
    expect(shouldSkipForBudget("projections", 480 - 1, false).skip).toBe(true);
    expect(shouldSkipForBudget("news", 460, false)).toEqual({ skip: false });
    expect(shouldSkipForBudget("injuries", 460, false)).toEqual({ skip: false });
  });

  it("at 480+, only injuries during a game window survive", () => {
    expect(shouldSkipForBudget("injuries", 480, true)).toEqual({ skip: false });
    expect(shouldSkipForBudget("injuries", 480, false).skip).toBe(true);
    expect(shouldSkipForBudget("news", 480, true).skip).toBe(true);
    expect(shouldSkipForBudget("ranks", 500, true).skip).toBe(true);
    expect(shouldSkipForBudget("projections", 500, true).skip).toBe(true);
  });
});

describe("isCircuitBreakerPaused", () => {
  const now = new Date("2026-09-17T18:00:00Z").getTime();

  it("is not paused when there's no stored pause", () => {
    expect(isCircuitBreakerPaused(null, now)).toBe(false);
    expect(isCircuitBreakerPaused(undefined, now)).toBe(false);
  });

  it("is not paused when the stored timestamp doesn't parse", () => {
    expect(isCircuitBreakerPaused("not-a-date", now)).toBe(false);
  });

  it("is paused when pausedUntil is in the future", () => {
    expect(isCircuitBreakerPaused(new Date(now + 10 * 60_000).toISOString(), now)).toBe(true);
  });

  it("is not paused once pausedUntil has passed", () => {
    expect(isCircuitBreakerPaused(new Date(now - 1_000).toISOString(), now)).toBe(false);
  });

  it("is not paused exactly at the pausedUntil boundary", () => {
    expect(isCircuitBreakerPaused(new Date(now).toISOString(), now)).toBe(false);
  });
});

describe("nextCircuitBreakerPausedUntil", () => {
  const now = new Date("2026-09-17T18:00:00Z").getTime();
  const priorPause = "2026-09-17T17:00:00.000Z";

  it("clears the pause on any success, even alongside a 429 in the same tick", () => {
    expect(nextCircuitBreakerPausedUntil(priorPause, { hadSuccess: true, hadRateLimited: false }, now)).toBeNull();
    expect(nextCircuitBreakerPausedUntil(priorPause, { hadSuccess: true, hadRateLimited: true }, now)).toBeNull();
    expect(nextCircuitBreakerPausedUntil(null, { hadSuccess: true, hadRateLimited: false }, now)).toBeNull();
  });

  it("opens a 60-minute pause on a 429-only tick with zero successes", () => {
    expect(nextCircuitBreakerPausedUntil(null, { hadSuccess: false, hadRateLimited: true }, now)).toBe(
      new Date(now + CIRCUIT_BREAKER_PAUSE_MS).toISOString(),
    );
  });

  it("extends an existing pause on another 429-only tick", () => {
    expect(nextCircuitBreakerPausedUntil(priorPause, { hadSuccess: false, hadRateLimited: true }, now)).toBe(
      new Date(now + CIRCUIT_BREAKER_PAUSE_MS).toISOString(),
    );
  });

  it("leaves state untouched when a tick has neither a success nor a 429", () => {
    expect(nextCircuitBreakerPausedUntil(null, { hadSuccess: false, hadRateLimited: false }, now)).toBeNull();
    expect(nextCircuitBreakerPausedUntil(priorPause, { hadSuccess: false, hadRateLimited: false }, now)).toBe(priorPause);
  });
});

describe("nyDateString", () => {
  it("returns the America/New_York calendar day, which can differ from UTC's", () => {
    // 2026-09-14T02:00:00Z is still 2026-09-13 (10pm) in America/New_York.
    expect(nyDateString(new Date("2026-09-14T02:00:00Z"))).toBe("2026-09-13");
    expect(nyDateString(new Date("2026-09-14T18:00:00Z"))).toBe("2026-09-14");
  });
});
