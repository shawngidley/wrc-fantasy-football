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
});
