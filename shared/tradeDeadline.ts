/**
 * The league trade deadline: Thursday, Nov 26, 2026 at 12:30 PM Eastern (EST,
 * UTC-5, since daylight time ended Sunday Nov 1). One source for the countdown,
 * the Rules and Trades text, and the server check that blocks late trades.
 */
export const TRADE_DEADLINE_MS = Date.parse("2026-11-26T12:30:00-05:00");
export const TRADE_DEADLINE_LABEL = "Thursday, Nov 26, 2026 at 12:30 PM ET";

/** A trade must be accepted before the deadline; the deadline moment itself is closed. */
export function isTradeDeadlinePassed(nowMs: number = Date.now()): boolean {
  return nowMs >= TRADE_DEADLINE_MS;
}

export function tradeDeadlineError(): string {
  return `The trade deadline passed on ${TRADE_DEADLINE_LABEL}. Trades can no longer be proposed or accepted.`;
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; totalMs: number };

export function countdownParts(nowMs: number = Date.now(), targetMs: number = TRADE_DEADLINE_MS): CountdownParts {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}
