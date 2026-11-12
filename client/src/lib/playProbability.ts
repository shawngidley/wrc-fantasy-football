/**
 * FantasyPros availability line: "98% chance to play".
 *
 * SCALE. The live feed sends `probability_of_playing` as a fraction
 * (0.97941 = 98%, 0.92297 = 92% -- values carrying that many decimals can only
 * be fractions). A value above 1 is therefore read as an already-percent
 * value, so the line degrades gracefully if FantasyPros ever switches to a
 * 0-100 scale instead of rendering every player as a flat "100%". The one
 * input the two scales genuinely disagree about is exactly 1: it is read as
 * 100%, because that is what the live fractional feed means by it, and that
 * feed does list fully-practicing players with no designation (see the filter
 * comment in server/fantasypros.ts's getFantasyProsInjuries). Note the
 * unasserted `probability_of_playing: 60` fixture in server/fantasypros.test.ts
 * assumes the other scale; nothing ever verified it.
 *
 * WHEN IT IS HIDDEN. No value, a nonsensical value, or a status that already
 * says the player is not playing -- "0% chance to play" next to "OUT" is just
 * noise. "Not playing" follows the vocabulary the site already uses: the red
 * bucket in useNFLInjuries' getInjuryColor (out / ir / pup / dnr) plus the
 * other never-playing designations getInjuryLabel knows about (injured
 * reserve, suspension, non-football injury). Matching only IR and Out would
 * leave a PUP or suspended player reading "0% chance to play". Kept as a local
 * list rather than imported from useNFLInjuries so this stays a pure module
 * with no React or tRPC in its import graph; if that vocabulary grows, it
 * grows in both places.
 */
const NOT_PLAYING_STATUSES = new Set([
  "out",
  "o",
  "ir",
  "injured reserve",
  "pup",
  "physically unable to perform",
  "dnr",
  "did not report",
  "nfi",
  "non football injury",
  "susp",
  "suspension",
  "suspended",
]);

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export function isNotPlayingStatus(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  if (NOT_PLAYING_STATUSES.has(s)) return true;
  // Qualified forms the feed also sends: "Injured Reserve - Designated to
  // Return", "Out (hamstring)", "Suspended 4 games". Anchored at the start so
  // a status that merely mentions the word (e.g. "Limited, ruled out of
  // Wednesday's session") is not mistaken for a game-day ruling.
  return /^injured reserve\b/.test(s) || /^out\b/.test(s) || /^suspend/.test(s);
}

export function formatPlayChance(
  probability: number | null | undefined,
  status?: string | null,
): string {
  if (probability == null || !Number.isFinite(probability) || probability < 0) return "";
  if (isNotPlayingStatus(status)) return "";
  const pct = Math.round(probability <= 1 ? probability * 100 : probability);
  return `${Math.min(100, Math.max(0, pct))}% chance to play`;
}
