import { describe, expect, it, vi } from "vitest";

const readWrcTeamSession = vi.hoisted(() => vi.fn());

vi.mock("./wrcTeamSession", () => ({
  readWrcTeamSession,
  clearWrcTeamSession: vi.fn(),
  writeWrcTeamSession: vi.fn(),
}));

import { appRouter } from "./routers";

describe("private league procedures", () => {
  it("rejects unauthenticated watchlist and Free Agents preference operations before database access", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.watchlist()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.toggleWatchlistPlayer({
      playerName: "Test Player",
      pos: "QB",
      nflTeam: "TEST",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.freeAgentColumnPreferences()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.saveFreeAgentColumnPreferences({ visibleColumns: ["bye", "wrcPts"] }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
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

  it("rejects unauthenticated manual transaction submissions", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.submitManualTransaction({
      targetTeamId: "team-owner",
      addPlayerName: "Test Add",
      addPlayerPos: "QB",
      addPlayerNflTeam: "TEST",
      dropPlayerName: "Test Drop",
      faab: 0,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated Settings PIN and team-media operations", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.changeTeamPin({ currentPin: "1234", newPin: "5678" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.uploadTeamMedia({
      kind: "logo",
      fileName: "logo.png",
      contentType: "image/png",
      base64Data: "YWJj",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.commissionerSetTeamPin({ teamId: "team-owner", newPin: "5678" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated passkey enrollment and credential-management operations", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.passkeys()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.startPasskeyRegistration()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.finishPasskeyRegistration({ challengeId: "a".repeat(20), response: {} }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.league.removePasskey({ credentialId: "credential-id" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated weekly result finalization", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.finalizeWeeklyResultsFromTank({ week: 1, season: 2026 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated commissioner money-management edits", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.commissionerSaveMoneyOwed({ updates: [{ id: "owner", name: "Owner", owed: 200 }] }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.league.commissionerSaveGowEntry({ week: 1, season: 2026, winner: "Owner", team: "Team", opponent: "Opponent", score: "100.0 – 90.0", amount: 30 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated commissioner protection-overview reads", async () => {
    readWrcTeamSession.mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.commissionerProtectionsOverview())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
