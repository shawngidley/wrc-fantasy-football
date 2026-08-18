import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, readWrcTeamSession, releaseUnprotectedPlayers } = vi.hoisted(() => ({
  from: vi.fn(),
  readWrcTeamSession: vi.fn(),
  releaseUnprotectedPlayers: vi.fn(),
}));

vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: { from } }));
vi.mock("./wrcTeamSession", () => ({
  readWrcTeamSession,
  clearWrcTeamSession: vi.fn(),
  writeWrcTeamSession: vi.fn(),
}));
vi.mock("./protectionRelease", () => ({ releaseUnprotectedPlayers }));

import { appRouter } from "./routers";

function configureDraftDatabase() {
  const playerInsert = vi.fn().mockResolvedValue({ error: null });
  const savedPick = {
    id: "draft-pick-1",
    round: 1,
    pick: 0,
    overall: 1,
    team_name: "Vipers",
    owner: "Greg",
    player_name: "Fernando Mendoza",
    player_pos: "QB",
    player_nfl_team: "LV",
    picked_at: "2026-08-18T00:00:00.000Z",
  };

  from.mockImplementation((table: string) => {
    if (table === "draft_state") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { started: true, paused: false, complete: false, current_round: 1, current_pick: 0 }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
        })),
      };
    }
    if (table === "draft_picks") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: savedPick, error: null }) })),
        })),
      };
    }
    if (table === "players") {
      return {
        select: vi.fn(() => ({
          ilike: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        })),
        insert: playerInsert,
      };
    }
    if (table === "teams") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { name: "Vipers" }, error: null }) })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { playerInsert };
}

describe("validated comprehensive draft player universe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readWrcTeamSession.mockResolvedValue({ teamId: "team-shawn", isCommissioner: true });
    releaseUnprotectedPlayers.mockResolvedValue({ releasedCount: 0 });
  });

  it("rejects an unknown player before reading draft availability or writing a pick", async () => {
    const { playerInsert } = configureDraftDatabase();
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.makeDraftPick({ playerName: "Not A Player", playerPos: "QB", playerNflTeam: "TEST" }))
      .rejects.toThrow("validated 2026 WRC draft pool");

    expect(playerInsert).not.toHaveBeenCalled();
  });

  it("records a validated rookie and creates its league roster row when no player row exists", async () => {
    const { playerInsert } = configureDraftDatabase();
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.makeDraftPick({ playerName: "Fernando Mendoza", playerPos: "QB", playerNflTeam: "LV" }))
      .resolves.toMatchObject({ pick: { player_name: "Fernando Mendoza", player_pos: "QB", player_nfl_team: "LV" } });

    expect(playerInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Fernando Mendoza",
      position: "QB",
      nfl_team: "LV",
      team_id: "team-greg",
      acquisition: "Rd 1",
      draft_round: 1,
      draft_pick: 1,
      is_starter: false,
    }));
  });
});
