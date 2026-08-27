/**
 * Canonical player-name matching for WRC.
 *
 * Root problem this solves: a player can be uploaded/rostered under one
 * name (e.g. "James Cook", from the commissioner's Excel import) while a
 * live data provider (Tank01, FantasyPros, ESPN) refers to the same person
 * with a generational suffix (e.g. "James Cook III"). Before this module
 * existed, at least seven different files each reimplemented their own
 * ad-hoc "lowercase + strip punctuation" normalizer, and none of them
 * stripped suffixes -- so "James Cook" -> "jamescook" while
 * "James Cook III" -> "jamescookiii" never matched anywhere in the app
 * (draft pool exclusion, protections, news mapping, stat lookups, etc).
 *
 * Every place in the codebase that compares two player names for equality
 * should normalize both sides through normalizePlayerName() here, instead
 * of writing a new ad-hoc normalizer.
 */

// Generational suffixes to strip as trailing words before normalizing.
// Order doesn't matter; matched as whole words only (so "Ii" the person's
// actual name, if that ever existed, wouldn't be mistakenly caught --
// though in practice these only ever appear as suffixes).
const SUFFIX_WORDS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/**
 * Known name variants that aren't simple suffix differences -- nicknames,
 * alternate spellings, or provider-specific quirks. Keyed by the *already
 * normalized* (suffix-stripped, alphanumeric-only, lowercase) form of the
 * variant, mapping to the already-normalized canonical form used for
 * comparison. Add new entries here as they're discovered; a suffix fix
 * alone won't catch these.
 */
const NAME_ALIASES: Record<string, string> = {
  // "Kenneth Gainwell" (some providers) vs "Kenny Gainwell" (WRC roster)
  kennethgainwell: "kennygainwell",
};

/**
 * Normalizes a player name for equality comparison across data sources.
 * Strips periods, splits on whitespace, drops trailing generational suffix
 * words (Jr/Sr/II/III/IV/V), rejoins, strips any remaining non-alphanumeric
 * characters, lowercases, and applies known aliases.
 *
 * normalizePlayerName("James Cook") === normalizePlayerName("James Cook III")
 * normalizePlayerName("Kenneth Gainwell") === normalizePlayerName("Kenny Gainwell")
 */
export function normalizePlayerName(name: string): string {
  const words = name
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean);

  while (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) {
    words.pop();
  }

  const normalized = words.join(" ").replace(/[^a-z0-9]/g, "");
  return NAME_ALIASES[normalized] ?? normalized;
}

/** True if two player names refer to the same person under this scheme. */
export function isSamePlayerName(a: string, b: string): boolean {
  return normalizePlayerName(a) === normalizePlayerName(b);
}
