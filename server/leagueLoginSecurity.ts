import { TRPCError } from "@trpc/server";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LOCKOUT_MS = 15 * 60_000;
const DEFAULT_OR_WEAK_PINS = new Set(["0000", "1111", "1234", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "0123", "4321"]);

type Attempt = { failures: number; windowStartedAt: number; lockedUntil: number };
const attempts = new Map<string, Attempt>();

function attemptKey(teamId: string, ip: string) {
  return `${teamId}:${ip || "unknown"}`;
}

export function isWeakLeaguePin(pin: string) {
  if (pin.length < 6 || DEFAULT_OR_WEAK_PINS.has(pin)) return true;
  if (/^([0-9])\1+$/.test(pin)) return true;
  const digits = pin.split("").map(Number);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  return ascending || descending || pin === pin.split("").reverse().join("");
}

export function assertLoginAllowed(teamId: string, ip: string, now = Date.now()) {
  const attempt = attempts.get(attemptKey(teamId, ip));
  if (attempt && attempt.lockedUntil > now) {
    const retryAfterMinutes = Math.ceil((attempt.lockedUntil - now) / 60_000);
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many PIN attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.` });
  }
}

export function recordLoginFailure(teamId: string, ip: string, now = Date.now()) {
  const key = attemptKey(teamId, ip);
  const existing = attempts.get(key);
  const attempt = !existing || now - existing.windowStartedAt > FAILURE_WINDOW_MS
    ? { failures: 0, windowStartedAt: now, lockedUntil: 0 }
    : existing;
  attempt.failures += 1;
  if (attempt.failures >= MAX_FAILURES) attempt.lockedUntil = now + LOCKOUT_MS;
  attempts.set(key, attempt);
}

export function clearLoginFailures(teamId: string, ip: string) {
  attempts.delete(attemptKey(teamId, ip));
}

export function assertStrongLeaguePin(pin: string) {
  if (!/^\d{6,12}$/.test(pin)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a PIN using six to twelve digits." });
  }
  if (isWeakLeaguePin(pin)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a PIN with at least six digits that is not a common or sequential pattern." });
  }
}

export function getClientIp(headers: { [key: string]: string | string[] | undefined }) {
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || "unknown";
}
