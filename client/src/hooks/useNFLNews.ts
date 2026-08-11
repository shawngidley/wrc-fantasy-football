/**
 * useNFLNews — fetches player news from Tank01 getNFLNews endpoint
 * Returns array of news items sorted newest first, cached 15 minutes.
 */

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
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
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/getNFLNews?recentNews=true`,
      {
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );
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
