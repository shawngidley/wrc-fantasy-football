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
