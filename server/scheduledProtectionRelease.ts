import type { Request, Response } from "express";
import { releaseUnprotectedPlayers } from "./protectionRelease";

export async function releasePostDeadlinePlayers(_req: Request, res: Response): Promise<void> {
  try {
    if (new Date().getUTCFullYear() !== 2026) {
      res.json({ ok: true, skipped: "outside-2026-protection-cycle" });
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
