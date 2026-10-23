import { describe, expect, it } from "vitest";
import { seedStartersFromSaved } from "./lineupSeed";
import { buildEffectiveStarters, type RosterPlayerWithId } from "@shared/effectiveStarters";

const SLOT_DEFS = [
  { slot: "QB", eligible: ["QB"] }, { slot: "RB1", eligible: ["RB"] }, { slot: "RB2", eligible: ["RB"] },
  { slot: "WR1", eligible: ["WR"] }, { slot: "WR2", eligible: ["WR"] }, { slot: "TE", eligible: ["TE"] },
  { slot: "SFLEX", eligible: ["QB", "RB", "WR", "TE"] }, { slot: "FLEX", eligible: ["RB", "WR", "TE"] },
  { slot: "K", eligible: ["K"] }, { slot: "DST", eligible: ["DST"] },
];
const key = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
const P = (id: string, name: string, pos: string, nflTeam: string) => ({ id, name, pos, nflTeam });
// Roster order puts Theta (worse ADP) ahead of Zeta (better ADP). WR2's saved player, Collins, was dropped.
const players = [
  P("1", "Qb One", "QB", "A"), P("2", "Qb Two", "QB", "B"), P("3", "Rb One", "RB", "C"), P("4", "Rb Two", "RB", "D"),
  P("5", "Wr One", "WR", "E"), P("6", "Theta Receiver", "WR", "TB"), P("7", "Zeta Receiver", "WR", "SEA"),
  P("8", "Te One", "TE", "F"), P("9", "Flex Rb", "RB", "G"), P("10", "Kicker", "K", "H"), P("11", "Defense", "DST", "I"),
];
const pool = [{ name: "Zeta Receiver", adp: 20 }, { name: "Theta Receiver", adp: 90 }];
const saved = { QB: "Qb One", SFLEX: "Qb Two", RB1: "Rb One", RB2: "Rb Two", WR1: "Wr One", WR2: "Nico Collins", TE: "Te One", FLEX: "Flex Rb", K: "Kicker", DST: "Defense" };

describe("seedStartersFromSaved", () => {
  it("keeps every saved player who is still on the roster in his saved slot", () => {
    const { bySlot } = seedStartersFromSaved(players, saved, SLOT_DEFS, pool, key);
    expect(bySlot.get("QB")?.name).toBe("Qb One");
    expect(bySlot.get("SFLEX")?.name).toBe("Qb Two");
    expect(bySlot.get("FLEX")?.name).toBe("Flex Rb");
  });

  it("fills a gap by best ADP, not roster order", () => {
    const { bySlot, bench } = seedStartersFromSaved(players, saved, SLOT_DEFS, pool, key);
    expect(bySlot.get("WR2")?.name).toBe("Zeta Receiver");
    expect(bench.map(p => p.name)).toEqual(["Theta Receiver"]);
  });

  it("starts the same players that official scoring and the server lock check start", () => {
    const roster: RosterPlayerWithId[] = players.map(p => ({ id: p.id, name: p.name, position: p.pos, nfl_team: p.nflTeam, team_id: "t" }));
    const rows = Object.entries(saved).map(([slot, player_name]) => ({ team_id: "t", slot, player_name, player_id: null, is_bench: false }));
    const server = buildEffectiveStarters(rows, roster, pool).map(s => s.player.name).sort();
    const page = Array.from(seedStartersFromSaved(players, saved, SLOT_DEFS, pool, key).bySlot.values()).map(p => p.name).sort();
    expect(page).toEqual(server);
  });

  it("gives two empty RB slots the first RB1 and then RB2", () => {
    const { bySlot } = seedStartersFromSaved(players, { ...saved, RB1: "Gone One", RB2: "Gone Two" }, SLOT_DEFS, pool, key);
    expect(bySlot.get("RB1")?.pos).toBe("RB");
    expect(bySlot.get("RB2")?.pos).toBe("RB");
    expect(bySlot.get("RB1")?.id).not.toBe(bySlot.get("RB2")?.id);
  });

  it("leaves a slot empty when nobody eligible is left", () => {
    const noK = players.filter(p => p.pos !== "K");
    const { bySlot } = seedStartersFromSaved(noK, saved, SLOT_DEFS, pool, key);
    expect(bySlot.has("K")).toBe(false);
  });

  // A bench slot key in the saved map is not a starter slot; the player stays a
  // backfill candidate, exactly as scoring treats him.
  it("ignores BENCH_n keys in the saved map", () => {
    const withBench = { ...saved, WR2: "Nico Collins", BENCH_0: "Zeta Receiver" };
    const { bySlot, bench } = seedStartersFromSaved(players, withBench, SLOT_DEFS, pool, key);
    expect(bySlot.get("WR2")?.name).toBe("Zeta Receiver");
    expect(bench.map(p => p.name)).toEqual(["Theta Receiver"]);
  });
});
