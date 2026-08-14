import { describe, expect, it, vi } from "vitest";

const readWrcTeamSession = vi.hoisted(() => vi.fn());

vi.mock("./wrcTeamSession", () => ({
  readWrcTeamSession,
  clearWrcTeamSession: vi.fn(),
  writeWrcTeamSession: vi.fn(),
}));

import { appRouter } from "./routers";

describe("private league procedures", () => {
  it("rejects unauthenticated watchlist reads and changes before database access", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.watchlist()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.toggleWatchlistPlayer({
      playerName: "Test Player",
      pos: "QB",
      nflTeam: "TEST",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated FAAB bids and non-commissioner bid review", async () => {
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });
    readWrcTeamSession.mockResolvedValue(null);
    await expect(caller.league.submitFaabBid({
      playerId: "test-player",
      playerName: "Test Player",
      playerPos: "QB",
      playerNflTeam: "TEST",
      bidAmount: 1,
      dropPlayerId: null,
      week: 1,
      season: 2026,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    readWrcTeamSession.mockResolvedValue({ teamId: "team-owner", isCommissioner: false });
    await expect(caller.league.commissionerFaabBids({ week: 1, season: 2026 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated protection reads and submissions", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.protections()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.saveProtections({ slots: [] }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated trade access before any trade asset operation", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.tradeInbox()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.createTradeProposal({
      toTeamId: "team-other",
      givePlayerNames: [],
      receivePlayerNames: [],
      giveFaab: 0,
      receiveFaab: 0,
      givePicks: [],
      receivePicks: [],
      note: "",
      counterToId: null,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.respondToTradeProposal({ proposalId: "00000000-0000-4000-8000-000000000001", action: "declined" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated draft controls and pick submissions", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.commissionerDraftAction({ action: "start" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.league.makeDraftPick({ playerName: "Test Player", playerPos: "QB", playerNflTeam: "TEST" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated commissioner result finalization", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.commissionerFinalizeWeeklyResult({ resultId: 1, homeScore: 100, awayScore: 90 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
