import type { Tank01Stats } from "./scoringEngine";

export type KickerPlayType = "fg" | "xp";
export type KickerPlayOutcome = "made" | "missed";

export type KickerPlayEvent = {
  playerName: string;
  type: KickerPlayType;
  outcome: KickerPlayOutcome;
  yards: number | null;
  text: string;
  /**
   * Identifies this exact play (ESPN play id, or its text plus which repeat of
   * that text it is) so that repeats of an identical play are not collapsed.
   * Named playKey, not key, because groupKickerEventsForDisplay in
   * client/src/lib/espnKickerEvents.ts emits a React `key` built from these
   * events and the two are unrelated. Optional because callers (and a good
   * many tests) build KickerPlayEvent literals directly; the parser always
   * sets it.
   */
  playKey?: string;
};

type EspnPlay = { id?: string | number; text?: string; type?: { text?: string } };

function normalName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function parseKickerName(raw: string): string {
  return raw.trim().replace(/\./g, ". ").replace(/\s+/g, " ");
}

export function parseEspnKickerEvents(summary: unknown): KickerPlayEvent[] {
  const root = summary as { drives?: { previous?: Array<{ plays?: EspnPlay[] }> }; plays?: EspnPlay[] };
  // The same play can be listed in both arrays, so repeats are dropped -- but
  // only TRUE repeats. Two real kicks can read byte-identically: a kicker who
  // makes two field goals of the same distance with the same center and holder
  // produces the same play text twice. That is not a rarity -- 2 of the 12
  // games on Sunday 2026-11-15 contained one (B.Aubrey's two 52-yarders in
  // SF @ DAL, C.Ryland's two 49-yarders in LAR @ ARI). Keying on text alone
  // silently dropped the second kick, and this parser feeds official scoring
  // in server/weeklyResultsFinalize.ts, not only the live display, so the
  // dropped kick cost real points in the standings.
  //
  // A play is therefore identified by its ESPN play id, or, failing that, by
  // its text plus how many times that same text occurred earlier in the SAME
  // array. Counting per array is what keeps the cross-array dedup honest: each
  // array can only contribute as many copies of a given text as it actually
  // holds, so the result is the larger of the two counts rather than their sum.
  //
  // Observed live (summary?event=401873065, 2026-11-16): `plays` is absent
  // from the payload entirely and every one of the 126 `drives.previous[]`
  // plays carried a unique id, so the id branch is the live path and the
  // text-count branch is the fallback for a payload that omits ids.
  const sources: EspnPlay[][] = [
    root.plays ?? [],
    (root.drives?.previous ?? []).flatMap(drive => drive.plays ?? []),
  ];
  const seen = new Set<string>();
  const events: KickerPlayEvent[] = [];

  for (const source of sources) {
    const textCounts = new Map<string, number>();
    for (const play of source) {
      const text = play.text?.trim() ?? "";
      const nth = textCounts.get(text) ?? 0;
      textCounts.set(text, nth + 1);
      const playKey = play.id != null && String(play.id) !== "" ? `id:${play.id}` : `text:${text}#${nth}`;
      const type = play.type?.text?.toLowerCase() ?? "";
      const fgMatch = text.match(/^(.+?)\s+(\d+)\s+yard field goal is\s+(good|no good|missed)/i);
      if (fgMatch && (type.includes("field goal") || /field goal/i.test(text))) {
        const event: KickerPlayEvent = {
          playerName: parseKickerName(fgMatch[1]),
          type: "fg",
          outcome: fgMatch[3].toLowerCase() === "good" ? "made" : "missed",
          yards: Number(fgMatch[2]),
          text,
          playKey,
        };
        if (!seen.has(playKey)) { seen.add(playKey); events.push(event); }
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
          playKey,
        };
        if (!seen.has(playKey)) { seen.add(playKey); events.push(event); }
      }
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

export function calculateWrcKickerPoints(events: KickerPlayEvent[], rawStats?: Tank01Stats): number {
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
