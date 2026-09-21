/**
 * WRC Fantasy Football — ESPN kicker events (client display layer)
 *
 * The core event parsing and point calculation (KickerPlayEvent,
 * parseEspnKickerEvents, matchesKickerEvent, getKickerEventsForPlayer,
 * calculateWrcKickerPoints) now live in shared/espnKickerEvents.ts, used
 * identically by both this client's live-scoring display and the
 * server's official weekly finalization (weeklyResultsFinalize.ts) --
 * moved there specifically so the server can compute the exact same,
 * accurate distance-based FG score that Live Scoring shows, instead of
 * a rough Tank01-aggregate fallback with no way to credit FG yardage
 * when Tank01's fgYds field is empty (confirmed live: routinely the
 * case). Re-exported here so existing imports elsewhere in the client
 * codebase keep working unchanged. This file now holds only the
 * client-specific display formatting built on top of that shared logic.
 */
export {
  parseEspnKickerEvents,
  matchesKickerEvent,
  getKickerEventsForPlayer,
  calculateWrcKickerPoints,
  type KickerPlayType,
  type KickerPlayOutcome,
  type KickerPlayEvent,
} from "@shared/espnKickerEvents";
import type { KickerPlayEvent } from "@shared/espnKickerEvents";

export function formatKickerEvent(event: KickerPlayEvent): string {
  if (event.type === "xp") return event.outcome === "made" ? "XP made (+1)" : "XP missed (-2)";
  const distance = `${event.yards ?? "?"} yd`;
  if (event.outcome === "missed") return `${distance} FG missed${(event.yards ?? 0) <= 49 ? " (-2)" : ""}`;
  const bonus = (event.yards ?? 0) >= 65 ? 2 : (event.yards ?? 0) >= 60 ? 1 : 0;
  return `${distance} FG made (+${((event.yards ?? 0) * 0.1 + bonus).toFixed(1)})`;
}

/**
 * Groups multiple made-FG events into a single display chip listing all
 * their yardages together (e.g. "20, 56 yd FG made (+7.6)") instead of a
 * separate "X yd FG made" chip per kick -- less repetitive when a kicker
 * has made more than one FG in a game. Missed FGs stay as individual
 * chips, one each.
 *
 * XP events are dropped entirely and never produce a chip: every other
 * position's chips summarize a whole stat line rather than listing each
 * play, and a row of one-per-kick XP chips made kickers the only
 * position rendering play-by-play. The XP points still count -- only
 * the chips are suppressed.
 */
export function groupKickerEventsForDisplay(events: KickerPlayEvent[]): { key: string; text: string; outcome: "made" | "missed" }[] {
  const madeFGs = events.filter(e => e.type === "fg" && e.outcome === "made");
  // A missed FG of 50+ yards costs no points at all, so it isn't shown
  // as a chip at all -- only a miss that actually costs points (49
  // yards or less) is displayed.
  const others = events.filter(e => {
    if (e.type === "xp") return false;
    if (e.type === "fg" && e.outcome === "made") return false;
    if (e.type === "fg" && e.outcome === "missed" && (e.yards ?? 0) >= 50) return false;
    return true;
  });

  const chips: { key: string; text: string; outcome: "made" | "missed" }[] = others.map((e, i) => ({
    key: `${e.text}-${i}`,
    text: formatKickerEvent(e),
    outcome: e.outcome,
  }));

  if (madeFGs.length > 0) {
    const yardages = madeFGs.map(e => e.yards ?? 0);
    const totalPoints = madeFGs.reduce((sum, e) => {
      const yards = e.yards ?? 0;
      const bonus = yards >= 65 ? 2 : yards >= 60 ? 1 : 0;
      return sum + yards * 0.1 + bonus;
    }, 0);
    chips.push({
      key: "made-fgs-combined",
      text: `${yardages.join(", ")} yd FG made (+${totalPoints.toFixed(1)})`,
      outcome: "made",
    });
  }

  return chips;
}
