/** Protection selections lock at 9:00 PM Eastern on Tuesday, August 25, 2026. */
export const WRC_PROTECTION_DEADLINE = new Date("2026-08-25T21:00:00-04:00");

export const WRC_PROTECTION_DEADLINE_DISPLAY = "Tuesday, August 25, 2026 · 9:00 PM ET";

export function isProtectionDeadlinePassed(now = Date.now()): boolean {
  return now >= WRC_PROTECTION_DEADLINE.getTime();
}
