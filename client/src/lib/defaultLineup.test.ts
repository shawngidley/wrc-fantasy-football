import { describe, expect, it } from "vitest";
import { buildDefaultStarters, fillEmptyStarterSlots } from "./defaultLineup";

const SLOT_ORDER = ["QB", "RB", "RB", "WR", "WR", "TE", "SFLEX", "FLEX", "K", "DST"];

const pool = [
  { name: "Josh Allen", adp: 26.1 },
  { name: "Lamar Jackson", adp: 33.5 },
  { name: "Christian McCaffrey", adp: 10.1 },
  { name: "Saquon Barkley", adp: 25.0 },
  { name: "Ja'Marr Chase", adp: 1.5 },
  { name: "Justin Jefferson", adp: 9.5 },
  { name: "Brock Bowers", adp: 18.3 },
  { name: "Brandon Aubrey", adp: 186.2 },
  { name: "SF 49ers", adp: 9999 },
];

function player(id: string, name: string, position: string, nfl_team = "XXX") {
  return { id, name, position, nfl_team };
}

describe("buildDefaultStarters", () => {
  it("picks the best-ADP player at each starter slot", () => {
    const teamPlayers = [
      player("1", "Lamar Jackson", "QB"),
      player("2", "Josh Allen", "QB"),
      player("3", "Saquon Barkley", "RB"),
      player("4", "Christian McCaffrey", "RB"),
      player("5", "Ja'Marr Chase", "WR"),
      player("6", "Justin Jefferson", "WR"),
      player("7", "Brock Bowers", "TE"),
      player("8", "Brandon Aubrey", "K"),
      player("9", "SF 49ers", "DST"),
    ];
    const starters = buildDefaultStarters(teamPlayers, pool);

    const qb = starters.find(s => s.slot === "QB");
    expect(qb?.player.name).toBe("Josh Allen"); // lower ADP than Lamar Jackson

    const rbs = starters.filter(s => s.slot === "RB");
    expect(rbs.map(s => s.player.name)).toEqual(["Christian McCaffrey", "Saquon Barkley"]);
  });

  it("fills SFLEX with the best remaining QB and FLEX with the best remaining RB", () => {
    const teamPlayers = [
      player("1", "Josh Allen", "QB"),
      player("2", "Lamar Jackson", "QB"),
      player("3", "Christian McCaffrey", "RB"),
      player("4", "Saquon Barkley", "RB"),
      player("5", "Kenny Gainwell", "RB"), // 3rd RB -- both dedicated RB slots fill first
    ];
    const starters = buildDefaultStarters(teamPlayers, [...pool, { name: "Kenny Gainwell", adp: 99.3 }]);

    expect(starters.find(s => s.slot === "SFLEX")?.player.name).toBe("Lamar Jackson");
    expect(starters.find(s => s.slot === "FLEX")?.player.name).toBe("Kenny Gainwell");
  });

  it("never assigns the same player to two slots", () => {
    const teamPlayers = [
      player("1", "Josh Allen", "QB"),
      player("2", "Christian McCaffrey", "RB"),
    ];
    const starters = buildDefaultStarters(teamPlayers, pool);
    const usedIds = starters.map(s => s.player.id);
    expect(new Set(usedIds).size).toBe(usedIds.length);
  });

  it("skips a slot entirely when no eligible player exists for it", () => {
    const teamPlayers = [player("1", "Josh Allen", "QB")];
    const starters = buildDefaultStarters(teamPlayers, pool);
    expect(starters.find(s => s.slot === "K")).toBeUndefined();
    expect(starters.find(s => s.slot === "DST")).toBeUndefined();
  });

  it("treats a player missing from the ADP pool as worst-available (ADP 9999)", () => {
    const teamPlayers = [
      player("1", "Josh Allen", "QB"),
      player("2", "Some Undrafted Rookie", "QB"),
    ];
    const starters = buildDefaultStarters(teamPlayers, pool);
    expect(starters.find(s => s.slot === "QB")?.player.name).toBe("Josh Allen");
    expect(starters.find(s => s.slot === "SFLEX")?.player.name).toBe("Some Undrafted Rookie");
  });

  it("returns an empty array for an empty roster", () => {
    expect(buildDefaultStarters([], pool)).toEqual([]);
  });
});

describe("fillEmptyStarterSlots", () => {
  it("fills empty starter slots from the bench with the best-ADP eligible player", () => {
    // A stale saved lineup left only QB + one RB as starters; the rest of the
    // real roster is on the bench. Every gap should fill from the bench.
    const starters = [
      { slot: "QB", player: player("1", "Josh Allen", "QB") },
      { slot: "RB", player: player("3", "Saquon Barkley", "RB") },
    ];
    const bench = [
      player("4", "Christian McCaffrey", "RB"),
      player("5", "Ja'Marr Chase", "WR"),
      player("6", "Justin Jefferson", "WR"),
      player("7", "Brock Bowers", "TE"),
      player("8", "Brandon Aubrey", "K"),
      player("9", "SF 49ers", "DST"),
      player("2", "Lamar Jackson", "QB"),
    ];
    const result = fillEmptyStarterSlots(starters, bench, SLOT_ORDER, pool);

    // Second RB slot takes the best remaining RB (McCaffrey), both WR fill,
    // TE/K/DST fill, SFLEX takes the leftover QB, FLEX has no RB/WR/TE left.
    const bySlot = (slot: string) => result.starters.filter(s => s.slot === slot).map(s => s.player.name);
    expect(bySlot("RB")).toEqual(["Saquon Barkley", "Christian McCaffrey"]);
    expect(bySlot("WR").sort()).toEqual(["Ja'Marr Chase", "Justin Jefferson"]);
    expect(bySlot("TE")).toEqual(["Brock Bowers"]);
    expect(bySlot("K")).toEqual(["Brandon Aubrey"]);
    expect(bySlot("DST")).toEqual(["SF 49ers"]);
    expect(bySlot("SFLEX")).toEqual(["Lamar Jackson"]);
    expect(bySlot("FLEX")).toEqual([]); // nothing eligible left
  });

  it("removes promoted players from the returned bench and leaves the overflow", () => {
    // WR-eligible starter slots (WR, WR, FLEX, SFLEX) can hold 4; give 5 WRs so
    // the worst-ADP one has nowhere to go and stays benched.
    const starters = [{ slot: "QB", player: player("1", "Josh Allen", "QB") }];
    const bench = [
      player("3", "Saquon Barkley", "RB"),
      player("99", "WR A", "WR"),
      player("98", "WR B", "WR"),
      player("97", "WR C", "WR"),
      player("96", "WR D", "WR"),
      player("95", "WR E", "WR"), // worst ADP -- overflow, stays benched
    ];
    const result = fillEmptyStarterSlots(starters, bench, SLOT_ORDER, [
      ...pool,
      { name: "WR A", adp: 50 }, { name: "WR B", adp: 60 }, { name: "WR C", adp: 70 },
      { name: "WR D", adp: 80 }, { name: "WR E", adp: 90 },
    ]);
    const startedIds = new Set(result.starters.map(s => s.player.id));
    expect(startedIds.has("3")).toBe(true); // RB promoted to an RB slot
    expect(result.bench.map(p => p.id)).toEqual(["95"]); // only the overflow WR
  });

  it("does not disturb a lineup that is already complete", () => {
    const starters = SLOT_ORDER.map((slot, i) => ({ slot, player: player(String(i), `P${i}`, "RB") }));
    const bench = [player("z", "Benchwarmer", "RB")];
    const result = fillEmptyStarterSlots(starters, bench, SLOT_ORDER, pool);
    expect(result.starters).toHaveLength(SLOT_ORDER.length);
    expect(result.bench.map(p => p.id)).toEqual(["z"]);
  });
});
