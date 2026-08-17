/**
 * useNFLNews — fetches player news from Tank01 getNFLNews endpoint
 * Returns array of news items sorted newest first, cached 15 minutes.
 */

const TANK01_BASE_URL = "/api/tank01";
const CACHE_KEY = "wrc_tank01_news_v1";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface Tank01NewsItem {
  title: string;
  link: string;
  image: string;
  playerIDs: string[]; // ESPN player IDs
}

export async function fetchTank01News(): Promise<Tank01NewsItem[]> {
  // Check cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch {}

  try {
    const res = await fetch(`${TANK01_BASE_URL}/getNFLNews?recentNews=true`);
    const json = await res.json();
    const items: Tank01NewsItem[] = Array.isArray(json.body) ? json.body : [];
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items }));
    } catch {}
    return items;
  } catch {
    return [];
  }
}
