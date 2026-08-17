import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseUnprotectedPlayers } from "./protectionRelease";

export async function releasePostDeadlinePlayers(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    res.json({ ok: true, ...(await releaseUnprotectedPlayers()) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { collector: "post-protection-player-release" },
    });
  }
}
