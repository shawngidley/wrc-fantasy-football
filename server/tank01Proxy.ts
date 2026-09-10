import type { Request, Response } from "express";

const TANK01_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const TANK01_TIMEOUT_MS = 15_000;
const ALLOWED_ENDPOINTS = new Set([
  "getNFLPlayerInfo",
  "getNFLTeams",
  "getNFLGamesForWeek",
  "getNFLProjections",
  "getNFLBoxScore",
  "getNFLTeamSchedule",
  "getNFLGamesForPlayer",
  "getNFLADP",
  "getNFLNews",
  "getNFLDepthCharts",
]);

// Server-side response cache, keyed by endpoint+params. Sits in front of
// every Tank01 call regardless of which client hook/page issued it, or
// whether that client is running the latest polling fixes -- a genuine
// chokepoint fix rather than relying on every open browser tab across
// every owner having reloaded with the newest client-side code. Directly
// caps upstream call volume even if many overlapping/duplicate client
// requests arrive for the same endpoint+params within the TTL window
// (e.g. many owners' tabs all requesting the same live game's box score
// at once). 20s is deliberately just under the 30s client poll interval,
// so legitimate polling still gets reasonably fresh data while
// overlapping/duplicate requests within that window share one response.
const CACHE_TTL_MS = 20_000;
const responseCache = new Map<string, { ts: number; status: number; contentType: string; body: string }>();

/** Test-only: clears the module-level response cache so test cases using
 * the same endpoint+params don't leak cached responses into each other. */
export function __clearTank01ProxyCacheForTests(): void {
  responseCache.clear();
}

/**
 * Proxies the small allowlist of Tank01 endpoints required by WRC. The browser
 * can choose only an approved endpoint and scalar query parameters; the RapidAPI
 * credential remains solely in the server environment.
 */
export async function proxyTank01Request(req: Request, res: Response) {
  const endpoint = req.params.endpoint;
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    res.status(404).json({ error: "Unknown Tank01 endpoint" });
    return;
  }

  const apiKey = process.env.TANK01_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Tank01 data is unavailable" });
    return;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string" && key.length <= 64 && value.length <= 256) query.set(key, value);
  }

  const cacheKey = `${endpoint}?${query.toString()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.status(cached.status).type(cached.contentType).send(cached.body);
    return;
  }

  try {
    const upstream = await fetch(`https://${TANK01_HOST}/${endpoint}?${query.toString()}`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": TANK01_HOST },
      signal: AbortSignal.timeout(TANK01_TIMEOUT_MS),
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();
    if (upstream.ok) responseCache.set(cacheKey, { ts: Date.now(), status: upstream.status, contentType, body });
    res.status(upstream.status).type(contentType).send(body);
  } catch (error) {
    console.error("Tank01 proxy request failed", error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Tank01 data request timed out" : "Tank01 data is temporarily unavailable" });
  }
}
