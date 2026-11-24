import { describe, expect, it } from "vitest";
import { TRADE_DEADLINE_LABEL, TRADE_DEADLINE_MS, countdownParts, isTradeDeadlinePassed, tradeDeadlineError } from "./tradeDeadline";

describe("trade deadline", () => {
  it("is 12:30 PM Eastern on Thursday Nov 26, 2026 (17:30 UTC)", () => {
    expect(new Date(TRADE_DEADLINE_MS).toISOString()).toBe("2026-11-26T17:30:00.000Z");
    expect(new Date(TRADE_DEADLINE_MS).getUTCDay()).toBe(4);
  });

  // The label is shown on the Rules page, the Trades page, the countdown and in
  // the server's rejection message. Deriving it from the constant means the two
  // cannot drift: move the deadline without moving the text and this fails,
  // rather than the site quietly advertising the wrong time.
  it("labels exactly the instant the constant encodes, in Eastern time", () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      }).formatToParts(new Date(TRADE_DEADLINE_MS)).map(p => [p.type, p.value]),
    );
    const derived = `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod} ET`;
    expect(derived).toBe(TRADE_DEADLINE_LABEL);
  });

  it("accepts before the deadline and rejects at or after it", () => {
    expect(isTradeDeadlinePassed(TRADE_DEADLINE_MS - 1)).toBe(false);
    expect(isTradeDeadlinePassed(TRADE_DEADLINE_MS)).toBe(true);
    expect(isTradeDeadlinePassed(TRADE_DEADLINE_MS + 60_000)).toBe(true);
  });

  it("splits the time left into days, hours, minutes and seconds", () => {
    const left = (1 * 86_400 + 3 * 3600 + 22 * 60 + 9) * 1000;
    expect(countdownParts(TRADE_DEADLINE_MS - left)).toMatchObject({ days: 1, hours: 3, minutes: 22, seconds: 9 });
  });

  it("never goes negative after the deadline", () => {
    expect(countdownParts(TRADE_DEADLINE_MS + 5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
  });

  it("names the deadline in the rejection an owner sees", () => {
    expect(tradeDeadlineError()).toContain(TRADE_DEADLINE_LABEL);
  });
});
