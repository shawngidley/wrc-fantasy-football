import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getFantasyProsNews, getFantasyProsRanks } from "./fantasypros";
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";
import { archiveFantasyProsNews, getArchiveScheduleTaskUid } from "./fantasyprosArchive";

export async function collectFantasyProsArchive(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    const configuredTaskUid = await getArchiveScheduleTaskUid();
    if (!configuredTaskUid || configuredTaskUid !== user.taskUid) {
      res.json({ ok: true, skipped: "unrecognized-schedule" });
      return;
    }
    const [news, ...rankGroups] = await Promise.all([
      getFantasyProsNews(100),
      ...["QB", "RB", "WR", "TE", "K"].map(position => getFantasyProsRanks(position, 1)),
    ]);
    const result = await archiveFantasyProsNews(attachFantasyProsPlayerNames(news, rankGroups.flat()));
    res.json({ ok: true, fetched: news.length, ...result });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { collector: "fantasypros-rolling-archive" },
    });
  }
}
