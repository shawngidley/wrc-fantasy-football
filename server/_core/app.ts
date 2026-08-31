import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { collectFantasyProsArchive } from "../scheduledFantasyProsArchive";
import { releasePostDeadlinePlayers } from "../scheduledProtectionRelease";
import { proxyTank01Request } from "../tank01Proxy";
import { proxyEspnAthlete, proxyEspnAthleteSubresource, proxyEspnNews, proxyEspnScoreboard, proxyEspnSummary } from "../espnProxy";
import { serveCompletedOffenseSnapshot } from "../seasonStatsSnapshot";
import { refreshSharedSeasonStatsSchedule } from "../seasonStatsRefresh";
import { refreshNflTeamAssignmentsSchedule } from "../nflTeamRefresh";
import { finalizeWeeklyResultsSchedule } from "../scheduledWeeklyResultsFinalize";

function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://site.api.espn.com",
      "media-src 'self' blob: https:",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "));
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/tank01/:endpoint", proxyTank01Request);
  app.get("/api/espn/athlete/:athleteId", proxyEspnAthlete);
  app.get("/api/espn/athlete/:athleteId/:subresource", proxyEspnAthleteSubresource);
  app.get("/api/espn/news", proxyEspnNews);
  app.get("/api/espn/scoreboard", proxyEspnScoreboard);
  app.get("/api/espn/summary", proxyEspnSummary);
  app.get("/api/season-stats-2025", serveCompletedOffenseSnapshot);
  // Vercel Cron only sends GET; these are gated by CRON_SECRET, not by the
  // caller's identity.
  app.get("/api/scheduled/season-stats-refresh", requireCronSecret, refreshSharedSeasonStatsSchedule);
  app.get("/api/scheduled/nfl-team-refresh", requireCronSecret, refreshNflTeamAssignmentsSchedule);
  app.get("/api/scheduled/fantasypros-archive", requireCronSecret, collectFantasyProsArchive);
  app.get("/api/scheduled/release-unprotected-players", requireCronSecret, releasePostDeadlinePlayers);
  app.get("/api/scheduled/weekly-results-finalize", requireCronSecret, finalizeWeeklyResultsSchedule);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
