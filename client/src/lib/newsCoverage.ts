export const FANTASYPROS_NEWS_WINDOW_DAYS = 7;

export type TimestampedNewsItem = { published: string };

export function filterNewsToRecentWindow<T extends TimestampedNewsItem>(
  items: T[],
  now = Date.now(),
  days = FANTASYPROS_NEWS_WINDOW_DAYS,
): T[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return items.filter(item => {
    const publishedAt = Date.parse(item.published);
    return Number.isFinite(publishedAt) && publishedAt >= cutoff && publishedAt <= now;
  });
}
