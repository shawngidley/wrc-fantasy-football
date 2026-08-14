import type { PlayerNewsItem } from "@/components/PlayerNewsRow";

export type NewsSourceFilter = "FANTASYPROS" | "TANK01" | "ALL";
export const FANTASY_NEWS_POSITIONS = ["QB", "RB", "WR", "TE", "K"] as const;

export function isEligibleFantasyNewsPosition(pos: string): boolean {
  return FANTASY_NEWS_POSITIONS.includes(pos as (typeof FANTASY_NEWS_POSITIONS)[number]);
}

export function filterNewsBySource(items: PlayerNewsItem[], source: NewsSourceFilter): PlayerNewsItem[] {
  if (source === "ALL") return items;
  const expectedSource = source === "FANTASYPROS" ? "FantasyPros" : "Tank01";
  return items.filter(item => item.source === expectedSource);
}

export function filterFantasyPositionNews(items: PlayerNewsItem[]): PlayerNewsItem[] {
  return items.filter(item => isEligibleFantasyNewsPosition(item.pos));
}

export function countEligibleFantasyNews(items: PlayerNewsItem[]): number {
  return filterFantasyPositionNews(items).length;
}

/** FantasyPros generic news may omit player_name; recover a headline-leading name for display. */
export function inferFantasyProsPlayerName(title: string): string {
  const cleaned = title.replace(/\s*\([^)]*\)/g, "").trim();
  const verbs = "is|to|week|primed|signing|signs|released|waived|misses|suffers|works|returns|dealing|placed|goes|not|will|plays|starts|exits|practices|participated|expected|day";
  const match = cleaned.match(new RegExp(`^([A-Z][A-Za-z.'-]*(?:\\s+(?:[A-Z][A-Za-z.'-]*|Jr\\.?|Sr\\.?|II|III)){1,3})(?=\\s+(?:${verbs})\\b)`));
  return match?.[1] ?? "FantasyPros Update";
}
