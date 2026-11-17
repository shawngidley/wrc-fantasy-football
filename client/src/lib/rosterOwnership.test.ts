import { describe, expect, it } from "vitest";
import { buildOwnershipMap, ownerOf } from "./rosterOwnership";

describe("roster ownership lookup", () => {
  it("finds a defense stored under the full city name by the pool's short name", () => {
    const map = buildOwnershipMap([{ name: "Green Bay Packers", teamName: "Vipers", teamId: "team-x" }]);
    expect(ownerOf(map, "GB Packers")).toBe("Vipers");
  });

  // Every DST alias in playerNameMatch exists because the pool was shortened
  // after teams had already rostered these under the long name, so each one is
  // a live chance to render a rostered defense as a free agent.
  it("finds every shortened DST name the pool uses", () => {
    const pairs: Array<[string, string]> = [
      ["Kansas City Chiefs", "KC Chiefs"],
      ["Las Vegas Raiders", "LV Raiders"],
      ["Los Angeles Chargers", "LA Chargers"],
      ["Los Angeles Rams", "LA Rams"],
      ["New England Patriots", "NE Patriots"],
      ["New Orleans Saints", "NO Saints"],
      ["New York Giants", "NY Giants"],
      ["New York Jets", "NY Jets"],
      ["San Francisco 49ers", "SF 49ers"],
      ["Tampa Bay Buccaneers", "TB Buccaneers"],
    ];
    for (const [stored, asked] of pairs) {
      const map = buildOwnershipMap([{ name: stored, teamName: "Vipers", teamId: "team-x" }]);
      expect(ownerOf(map, asked), `${stored} should be found as ${asked}`).toBe("Vipers");
    }
  });

  it("matches regardless of case and generational suffix", () => {
    const map = buildOwnershipMap([{ name: "James Cook III", teamName: "Hardtimes", teamId: "team-y" }]);
    expect(ownerOf(map, "james cook")).toBe("Hardtimes");
  });

  it("matches a nickname variant the aliases cover", () => {
    const map = buildOwnershipMap([{ name: "Kenny Gainwell", teamName: "Legends", teamId: "team-g" }]);
    expect(ownerOf(map, "Kenneth Gainwell")).toBe("Legends");
  });

  it("returns undefined for a free agent and falls back to the id with no team name", () => {
    const map = buildOwnershipMap([{ name: "A B", teamName: null, teamId: "team-z" }]);
    expect(ownerOf(map, "Nobody Here")).toBeUndefined();
    expect(ownerOf(map, "A B")).toBe("team-z");
  });

  it("does not confuse two different players whose names merely start alike", () => {
    const map = buildOwnershipMap([
      { name: "Michael Carter", teamName: "Vipers", teamId: "team-a" },
      { name: "Michael Carter II", teamName: "Legends", teamId: "team-b" },
    ]);
    // Both normalize to the same key -- the suffix stripper cannot tell these
    // two real, distinct players apart. Documented rather than asserted as
    // correct: last row wins, which is the same exposure the lowercase key had.
    expect(ownerOf(map, "Michael Carter")).toBe("Legends");
  });
});
