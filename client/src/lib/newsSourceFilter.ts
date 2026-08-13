import type { PlayerNewsItem } from "@/components/PlayerNewsRow";

export type NewsSourceFilter = "FANTASYPROS" | "TANK01" | "ALL";

export function filterNewsBySource(items: PlayerNewsItem[], source: NewsSourceFilter): PlayerNewsItem[] {
  if (source === "ALL") return items;
  const expectedSource = source === "FANTASYPROS" ? "FantasyPros" : "Tank01";
  return items.filter(item => item.source === expectedSource);
}

/** FantasyPros generic news may omit player_name; recover a headline-leading name for display. */
export function inferFantasyProsPlayerName(title: string): string {
  const cleaned = title.replace(/\s*\([^)]*\)/g, "").trim();
  const verbs = "is|signs|released|waived|misses|suffers|works|returns|dealing|placed|goes|not|will|plays|starts|exits|practices|participated|expected|day";
  const match = cleaned.match(new RegExp(`^([A-Z][A-Za-z.'-]*(?:\\s+(?:[A-Z][A-Za-z.'-]*|Jr\\.?|Sr\\.?|II|III)){1,3})(?=\\s+(?:${verbs})\\b)`));
  return match?.[1] ?? "FantasyPros Update";
}
