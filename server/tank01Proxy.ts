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

  try {
    const upstream = await fetch(`https://${TANK01_HOST}/${endpoint}?${query.toString()}`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": TANK01_HOST },
      signal: AbortSignal.timeout(TANK01_TIMEOUT_MS),
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();
    res.status(upstream.status).type(contentType).send(body);
  } catch (error) {
    console.error("Tank01 proxy request failed", error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Tank01 data request timed out" : "Tank01 data is temporarily unavailable" });
  }
}
