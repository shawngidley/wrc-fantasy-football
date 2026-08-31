import type { Request, Response } from "express";

const ESPN_TIMEOUT_MS = 8_000;

/**
 * Proxies a single, narrow ESPN endpoint: athlete lookup by numeric id, used
 * only to read birthDate for computing a player's age on the Lineup page.
 * The client previously called site.api.espn.com directly from the browser
 * -- the only external API call in this codebase that bypassed the
 * server-side proxy pattern every other integration uses (Tank01,
 * FantasyPros). That's a likely CORS failure point: a raw cross-origin
 * fetch() to a JSON API needs the target to return matching
 * Access-Control-Allow-Origin headers, which isn't guaranteed and wasn't
 * something this app controlled either way. Routing it through the app's
 * own server sidesteps CORS entirely, since it's a server-to-server
 * request rather than a browser-to-third-party one.
 */
export async function proxyEspnAthlete(req: Request, res: Response) {
  const athleteId = req.params.athleteId;
  if (!/^\d{1,12}$/.test(athleteId ?? "")) {
    res.status(400).json({ error: "Invalid athlete id" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athleteId}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN request failed with status ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "ESPN request failed" });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Proxies ESPN's per-athlete gamelog/stats subresources, used by
 * useESPNSeasonStats.ts for historical season-by-season stats on the
 * Player Page. Same CORS-avoidance rationale as the other proxies above --
 * a third separate direct browser-to-ESPN integration found with the same
 * failure mode.
 */
const ALLOWED_ATHLETE_SUBRESOURCES = new Set(["gamelog", "stats"]);
export async function proxyEspnAthleteSubresource(req: Request, res: Response) {
  const athleteId = req.params.athleteId;
  const subresource = req.params.subresource;
  if (!/^\d{1,12}$/.test(athleteId ?? "")) {
    res.status(400).json({ error: "Invalid athlete id" });
    return;
  }
  if (!ALLOWED_ATHLETE_SUBRESOURCES.has(subresource ?? "")) {
    res.status(404).json({ error: "Unknown ESPN subresource" });
    return;
  }
  const season = /^\d{4}$/.test(String(req.query.season ?? "")) ? String(req.query.season) : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const url = new URL(`https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athleteId}/${subresource}`);
    if (season) url.searchParams.set("season", season);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN request failed with status ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "ESPN request failed" });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Proxies ESPN's NFL news-articles feed, used by PlayerNews.tsx. Same
 * CORS-avoidance rationale as the other proxies above -- a second, separate
 * direct browser-to-ESPN fetch (a different endpoint entirely,
 * site.api.espn.com/apis/site/v2/... for articles rather than
 * apis/common/v3/.../athletes for player bio data) that had the same
 * likely-CORS failure mode. It was wrapped in Promise.allSettled, so a
 * failure here was completely silent -- no console error, no visible sign
 * of anything wrong, just a quietly empty ESPN article list feeding into
 * the combined news feed.
 */
export async function proxyEspnNews(req: Request, res: Response) {
  const limit = /^\d{1,4}$/.test(String(req.query.limit ?? "")) ? String(req.query.limit) : "200";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=${limit}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN request failed with status ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "ESPN request failed" });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Proxies ESPN's scoreboard and game-summary endpoints, used by
 * useNFLLiveScores.ts to parse kicker-specific scoring plays that other
 * sources don't provide in enough detail. A fourth and fifth separate
 * direct browser-to-ESPN integration found with the same failure mode --
 * this one on the live scoring page, arguably the highest-stakes place
 * for this class of bug to have been sitting silently broken.
 */
export async function proxyEspnScoreboard(req: Request, res: Response) {
  const dates = /^\d{8}$/.test(String(req.query.dates ?? "")) ? String(req.query.dates) : undefined;
  if (!dates) {
    res.status(400).json({ error: "Invalid or missing dates (expected YYYYMMDD)" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dates}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN request failed with status ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "ESPN request failed" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyEspnSummary(req: Request, res: Response) {
  const event = /^\d{1,20}$/.test(String(req.query.event ?? "")) ? String(req.query.event) : undefined;
  if (!event) {
    res.status(400).json({ error: "Invalid or missing event id" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN request failed with status ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "ESPN request failed" });
  } finally {
    clearTimeout(timeout);
  }
}
