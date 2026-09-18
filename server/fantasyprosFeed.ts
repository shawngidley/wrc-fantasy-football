import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { CIRCUIT_BREAKER_ROW_KEY } from "./fantasyprosFetcher";

/**
 * Server-to-server only: the CVC football site reads FantasyPros data
 * through here instead of calling FantasyPros itself, so both sites share
 * one 500/day budget without doubling the call volume against it. No CORS
 * is configured on purpose -- this is never called from a browser.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.FANTASYPROS_FEED_SECRET;
  return Boolean(secret) && req.headers["x-feed-secret"] === secret;
}

export async function serveFantasyProsFeed(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!key) {
    res.status(400).json({ error: "missing required query param: key" });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from("fantasypros_cache")
    .select("key, payload, fetched_at, expires_at")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: `no cached data for key "${key}"` });
    return;
  }
  res.setHeader("Cache-Control", "s-maxage=60");
  res.json(data);
}

export async function serveFantasyProsFeedKeys(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from("fantasypros_cache")
    .select("key, fetched_at, expires_at")
    .order("key");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.setHeader("Cache-Control", "s-maxage=60");
  // The circuit breaker's sentinel row shares this table; it isn't a dataset.
  res.json({ keys: (data ?? []).filter(row => row.key !== CIRCUIT_BREAKER_ROW_KEY) });
}
