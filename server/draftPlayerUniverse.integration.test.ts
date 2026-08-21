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
import { getDraftUniversePlayerByName } from "../shared/draftPlayerUniverse";

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
    if (table === "draft_lottery") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { result_owners: null }, error: null }) })),
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

function configureQueueDatabase() {
  const queueInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: { id: 19, team_id: "team-shawn", player_name: "Fernando Mendoza", player_pos: "QB", player_nfl_team: "LV", rank: 1, season: 2026 },
        error: null,
      }),
    })),
  }));
  let draftQueueCall = 0;

  from.mockImplementation((table: string) => {
    if (table !== "draft_queue") throw new Error(`Unexpected table: ${table}`);
    draftQueueCall += 1;
    if (draftQueueCall === 1) {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
            })),
          })),
        })),
      };
    }
    if (draftQueueCall === 2) {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })),
            })),
          })),
        })),
      };
    }
    return { insert: queueInsert };
  });

  return { queueInsert };
}

function configureTradeProposalDatabase() {
  const proposalInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id: "proposal-1" }, error: null }),
    })),
  }));
  let teamCall = 0;
  let playerCall = 0;

  from.mockImplementation((table: string) => {
    if (table === "teams") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockImplementation(async () => {
              teamCall += 1;
              return {
                data: teamCall === 1
                  ? { id: "team-shawn", name: "Vipers", faab: 1000 }
                  : { id: "team-dan", name: "Legion of Doom", faab: 1000 },
                error: null,
              };
            }),
          })),
        })),
      };
    }
    if (table === "players") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => {
              playerCall += 1;
              return Promise.resolve({
                data: [{ name: playerCall === 1 ? "Tua Tagovailoa" : "Javonte Williams" }],
                error: null,
              });
            }),
          })),
        })),
      };
    }
    if (table === "trade_proposals") return { insert: proposalInsert };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { proposalInsert };
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

  it("rejects an unknown player before it can be added to a private draft queue", async () => {
    from.mockImplementation(() => { throw new Error("Queue database must not be called for an unknown player"); });
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.addDraftQueueItem({ season: 2026, playerName: "Not A Player", playerPos: "QB", playerNflTeam: "TEST" }))
      .rejects.toThrow("validated 2026 WRC draft pool");
  });

  it("adds a validated rookie to only the signed-in owner’s private draft queue", async () => {
    const { queueInsert } = configureQueueDatabase();
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.addDraftQueueItem({ season: 2026, playerName: "Fernando Mendoza", playerPos: "QB", playerNflTeam: "LV" }))
      .resolves.toMatchObject({ team_id: "team-shawn", player_name: "Fernando Mendoza", player_pos: "QB", player_nfl_team: "LV" });

    expect(queueInsert).toHaveBeenCalledWith(expect.objectContaining({
      team_id: "team-shawn",
      player_name: "Fernando Mendoza",
      player_pos: "QB",
      player_nfl_team: "LV",
      season: 2026,
    }));
  });

  it("retains Draft Players identity data for a queued player", () => {
    const player = getDraftUniversePlayerByName("Fernando Mendoza");

    expect(player).toMatchObject({
      name: "Fernando Mendoza",
      pos: "QB",
      nflTeam: "LV",
      bye: 13,
      sourcePlayerId: "4837248",
    });
    expect(player?.adp).toBeGreaterThan(0);
  });

  it("creates a valid player trade proposal when the recipient uses the canonical database team ID", async () => {
    const { proposalInsert } = configureTradeProposalDatabase();
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });

    await expect(caller.league.createTradeProposal({
      toTeamId: "team-dan",
      givePlayerNames: ["Tua Tagovailoa"],
      receivePlayerNames: ["Javonte Williams"],
      giveFaab: 0,
      receiveFaab: 0,
      givePicks: [],
      receivePicks: [],
      note: "Let's make a trade.",
      counterToId: null,
    })).resolves.toMatchObject({ id: "proposal-1", recipientName: "Legion of Doom", isCounter: false });

    expect(proposalInsert).toHaveBeenCalledWith(expect.objectContaining({
      from_team_id: "team-shawn",
      to_team_id: "team-dan",
      give_player_ids: ["Tua Tagovailoa"],
      receive_player_ids: ["Javonte Williams"],
    }));
  });
});
