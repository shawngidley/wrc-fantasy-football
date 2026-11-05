/**
 * Picks the news items for one player on the player page.
 *
 * Two sources can answer: a lookup by FantasyPros player id, and the
 * league-wide feed filtered by name. Before, the id lookup replaced the name
 * match as soon as it loaded, even when it came back empty. That made news
 * show for a moment and then vanish. Now the two lists are combined, so an
 * empty or partial id lookup can never remove news the name match found.
 */
export interface SelectableNewsItem {
  id: number;
  playerName: string;
  title: string;
  published: string;
  link: string;
}

function itemKey(item: SelectableNewsItem): string {
  return item.id ? `id:${item.id}` : `${item.link}|${item.title}|${item.published}`;
}

export function selectPlayerNews<T extends SelectableNewsItem>(
  byId: T[] | undefined,
  leagueFeed: T[] | undefined,
  matchesPlayer: (playerName: string) => boolean,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const add = (item: T) => {
    const key = itemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  (byId ?? []).forEach(add);
  (leagueFeed ?? []).filter(item => matchesPlayer(item.playerName)).forEach(add);
  return out.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
}
