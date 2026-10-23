import { describe, expect, it, vi } from "vitest";
import { assertLineupMovesAllowed, type LineupLockDeps } from "./lineupLockGuard";
import type { RosterPlayerWithId } from "../shared/effectiveStarters";

const P = (id: string, name: string, position: string, nfl_team: string): RosterPlayerWithId => ({ id, name, position, nfl_team, team_id: "team-x" });
const roster = [
  P("1", "Caleb Williams", "QB", "CHI"), P("2", "Daniel Jones", "QB", "IND"),
  P("3", "Kyren Williams", "RB", "LAR"), P("4", "J.K. Dobbins", "RB", "DEN"), P("11", "Blake Corum", "RB", "LAR"),
  P("5", "Jaxon Smith-Njigba", "WR", "SEA"), P("6", "Nico Collins", "WR", "HOU"), P("8", "Jaylen Waddle", "WR", "DEN"),
  P("7", "Kyle Pitts", "TE", "ATL"), P("9", "Cairo Santos", "K", "CHI"), P("10", "Indianapolis Colts", "DST", "IND"),
];
const row = (slot: string, player_name: string, is_bench = false) => ({ slot, player_id: player_name, player_name, is_bench });
const savedStarters = [
  row("QB", "Caleb Williams"), row("SFLEX", "Daniel Jones"), row("RB1", "Kyren Williams"), row("RB2", "J.K. Dobbins"),
  row("WR1", "Jaxon Smith-Njigba"), row("WR2", "Nico Collins"), row("TE", "Kyle Pitts"), row("FLEX", "Jaylen Waddle"),
  row("K", "Cairo Santos"), row("DST", "Indianapolis Colts"), row("BENCH_0", "Blake Corum", true),
].map(r => ({ ...r, team_id: "team-x" }));

function deps(started: string[], opts: { throws?: boolean; roster?: RosterPlayerWithId[]; saved?: typeof savedStarters } = {}): LineupLockDeps & { hasGameStarted: ReturnType<typeof vi.fn> } {
  return {
    loadRoster: async () => opts.roster ?? roster,
    loadSavedLineup: async () => opts.saved ?? savedStarters,
    hasGameStarted: vi.fn(async (team: string) => { if (opts.throws) throw new Error("tank01 down"); return started.includes(team); }),
  };
}
const save = (rows: ReturnType<typeof row>[], d: LineupLockDeps) => assertLineupMovesAllowed({ teamId: "team-x", week: 7, season: 2026, rows }, d);

// Corum (LAR, bench) swapped in for Kyren Williams (LAR, RB1).
const swapRbs = [...savedStarters.filter(r => r.player_name !== "Kyren Williams" && r.player_name !== "Blake Corum"),
  row("RB1", "Blake Corum"), row("BENCH_0", "Kyren Williams", true)];

/** Nico Collins dropped: WR2 is an empty slot, and the two remaining bench WRs
 * are invented names (no ADP), so a scoring backfill takes the first in roster
 * order -- Zeta, whose game has started. */
function wr2GapFixture() {
  const gapRoster = [
    ...roster.filter(p => p.name !== "Nico Collins"),
    P("20", "Zeta Receiver", "WR", "SEA"),
    P("21", "Theta Receiver", "WR", "TB"),
  ];
  const savedWithGap = savedStarters.filter(r => r.player_name !== "Nico Collins");
  const pageFilledWr2 = [...savedWithGap, row("WR2", "Theta Receiver")];
  return { gapRoster, savedWithGap, pageFilledWr2 };
}

describe("assertLineupMovesAllowed", () => {
  it("allows an unchanged lineup without checking any kickoff, even if every game has started", async () => {
    const d = deps(["CHI", "IND", "LAR", "DEN", "SEA", "HOU", "ATL"]);
    await expect(save(savedStarters, d)).resolves.toBeUndefined();
    expect(d.hasGameStarted).not.toHaveBeenCalled();
  });

  it("allows reordering the bench and RB1 / RB2 slot numbers", async () => {
    const d = deps(["CHI", "IND", "LAR", "DEN"]);
    const reordered = savedStarters.map(r => r.slot === "RB1" ? { ...r, slot: "RB2" } : r.slot === "RB2" ? { ...r, slot: "RB1" } : r);
    await expect(save(reordered, d)).resolves.toBeUndefined();
  });

  it("allows a swap when neither player's game has started", async () => {
    await expect(save(swapRbs, deps(["CHI"]))).resolves.toBeUndefined();
  });

  it("blocks a swap that moves a player whose game has started", async () => {
    await expect(save(swapRbs, deps(["LAR"]))).rejects.toThrow(/game has already started/);
  });

  it("only blocks the player who moved, not locked players who stayed put", async () => {
    // CHI and IND players are locked but untouched; the swap is two unlocked LAR players.
    await expect(save(swapRbs, deps(["CHI", "IND", "DEN"]))).resolves.toBeUndefined();
  });

  it("refuses the save when kickoff times can't be verified for a moved player", async () => {
    await expect(save(swapRbs, deps([], { throws: true }))).rejects.toThrow(/Couldn't verify kickoff times/);
  });

  // The baseline is the SAVED lineup, not buildEffectiveStarters. Scoring fills
  // an empty slot by best ADP while the Lineup page fills it with the first
  // eligible player in roster order, so the two can pick different players. If
  // scoring's pick counted as "currently starting", this untouched save would
  // be refused naming a player the owner's page never showed as a starter --
  // and no action of theirs could clear it.
  it("does not refuse a save over a player only a scoring backfill would have started", async () => {
    // Nico Collins was dropped, so the saved lineup's WR2 slot is empty and the
    // only bench WRs left are Zeta (SEA, already played) and Theta (TB, not
    // yet). A scoring backfill promotes Zeta; the owner's page promoted Theta.
    // The owner saves Theta and touches nothing else.
    const { gapRoster, savedWithGap, pageFilledWr2 } = wr2GapFixture();
    await expect(save(pageFilledWr2, deps(["SEA"], { roster: gapRoster, saved: savedWithGap })))
      .resolves.toBeUndefined();
  });

  it("still blocks putting a locked player into an empty slot", async () => {
    const { gapRoster, savedWithGap } = wr2GapFixture();
    const startsLocked = [...savedWithGap, row("WR2", "Zeta Receiver")];
    await expect(save(startsLocked, deps(["SEA"], { roster: gapRoster, saved: savedWithGap })))
      .rejects.toThrow(/Zeta Receiver's game has already started/);
  });
});
