import { describe, expect, it } from "vitest";
import { buildDefaultStarters } from "./defaultLineup";

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
