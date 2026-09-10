export type KickerPlayType = "fg" | "xp";
export type KickerPlayOutcome = "made" | "missed";

export type KickerPlayEvent = {
  playerName: string;
  type: KickerPlayType;
  outcome: KickerPlayOutcome;
  yards: number | null;
  text: string;
};

type EspnPlay = { text?: string; type?: { text?: string } };

function normalName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function parseKickerName(raw: string): string {
  return raw.trim().replace(/\./g, ". ").replace(/\s+/g, " ");
}

export function parseEspnKickerEvents(summary: unknown): KickerPlayEvent[] {
  const root = summary as { drives?: { previous?: Array<{ plays?: EspnPlay[] }> }; plays?: EspnPlay[] };
  const plays = [
    ...(root.plays ?? []),
    ...((root.drives?.previous ?? []).flatMap(drive => drive.plays ?? [])),
  ];
  const seen = new Set<string>();
  const events: KickerPlayEvent[] = [];

  for (const play of plays) {
    const text = play.text?.trim() ?? "";
    const type = play.type?.text?.toLowerCase() ?? "";
    const fgMatch = text.match(/^(.+?)\s+(\d+)\s+yard field goal is\s+(good|no good|missed)/i);
    if (fgMatch && (type.includes("field goal") || /field goal/i.test(text))) {
      const event: KickerPlayEvent = {
        playerName: parseKickerName(fgMatch[1]),
        type: "fg",
        outcome: fgMatch[3].toLowerCase() === "good" ? "made" : "missed",
        yards: Number(fgMatch[2]),
        text,
      };
      const key = `${event.playerName}|${event.type}|${event.outcome}|${event.yards}|${text}`;
      if (!seen.has(key)) { seen.add(key); events.push(event); }
      continue;
    }
    const xpMatch = text.match(/^(.+?)\s+(?:extra point|pat)\s+is\s+(good|no good|missed)/i);
    if (xpMatch && (type.includes("extra point") || /extra point|\bpat\b/i.test(text))) {
      const event: KickerPlayEvent = {
        playerName: parseKickerName(xpMatch[1]),
        type: "xp",
        outcome: xpMatch[2].toLowerCase() === "good" ? "made" : "missed",
        yards: null,
        text,
      };
      const key = `${event.playerName}|${event.type}|${event.outcome}|${text}`;
      if (!seen.has(key)) { seen.add(key); events.push(event); }
    }
  }
  return events;
}

export function matchesKickerEvent(eventPlayerName: string, fullPlayerName: string): boolean {
  const event = normalName(eventPlayerName);
  const full = normalName(fullPlayerName);
  if (!event || !full) return false;
  if (event === full) return true;
  const fullParts = fullPlayerName.toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  const surname = fullParts[fullParts.length - 1] ?? "";
  return event.startsWith(fullParts[0]?.[0] ?? "") && event.endsWith(normalName(surname));
}

export function getKickerEventsForPlayer(events: KickerPlayEvent[], fullPlayerName: string): KickerPlayEvent[] {
  return events.filter(event => matchesKickerEvent(event.playerName, fullPlayerName));
}

export function calculateWrcKickerPoints(events: KickerPlayEvent[], rawStats?: import("./scoringEngine").Tank01Stats): number {
  // FG scoring genuinely needs ESPN's play-by-play events, since the WRC
  // distance-based formula (0.1/yard + bonus for 60+/65+) requires each
  // individual kick's exact yardage -- Tank01's box score only gives
  // aggregate fgMade/fgAttempts, not per-kick distance.
  const fgPoints = events
    .filter(event => event.type === "fg")
    .reduce((total, event) => {
      if (event.outcome === "missed") return total + ((event.yards ?? 0) <= 49 ? -2 : 0);
      const yards = event.yards ?? 0;
      const bonus = yards >= 65 ? 2 : yards >= 60 ? 1 : 0;
      return total + yards * 0.1 + bonus;
    }, 0);

  // XP scoring is always a flat +1 made / -2 missed regardless of any
  // distance-like variable, so it doesn't need play-by-play text parsing
  // at all -- and relying on it was the actual bug here: ESPN's exact
  // wording for an XP play doesn't always match the parser's regex,
  // silently dropping that play from the events array entirely (with no
  // error, since an empty match just means "no XP events found" rather
  // than "XP data is missing"). Tank01's structured xpMade/xpAttempts is
  // reliable and needs no parsing, so prefer it whenever available.
  let xpPoints: number;
  if (rawStats?.Kicking?.xpMade !== undefined || rawStats?.Kicking?.xpAttempts !== undefined) {
    const xpMade = Number(rawStats.Kicking.xpMade ?? 0);
    const xpAttempts = Number(rawStats.Kicking.xpAttempts ?? 0);
    const xpMissed = Math.max(0, xpAttempts - xpMade);
    xpPoints = xpMade * 1 + xpMissed * -2;
  } else {
    xpPoints = events
      .filter(event => event.type === "xp")
      .reduce((total, event) => total + (event.outcome === "made" ? 1 : -2), 0);
  }

  return Math.round((fgPoints + xpPoints) * 10) / 10;
}

export function formatKickerEvent(event: KickerPlayEvent): string {
  if (event.type === "xp") return event.outcome === "made" ? "XP made (+1)" : "XP missed (-2)";
  const distance = `${event.yards ?? "?"} yd`;
  if (event.outcome === "missed") return `${distance} FG missed${(event.yards ?? 0) <= 49 ? " (-2)" : ""}`;
  const bonus = (event.yards ?? 0) >= 65 ? 2 : (event.yards ?? 0) >= 60 ? 1 : 0;
  return `${distance} FG made (+${((event.yards ?? 0) * 0.1 + bonus).toFixed(1)})`;
}
