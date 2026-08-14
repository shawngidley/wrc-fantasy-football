import { describe, expect, it } from "vitest";
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";

describe("attachFantasyProsPlayerNames", () => {
  it("uses the FantasyPros player ID when generic news omits player_name", () => {
    const [item] = attachFantasyProsPlayerNames(
      [{ playerId: 23021, playerName: "", team: "", title: "Kenneth Walker III primed for workhorse role" }],
      [{ playerId: 23021, name: "Kenneth Walker III", team: "SEA", position: "RB" }],
    );
    expect(item.playerName).toBe("Kenneth Walker III");
    expect(item.team).toBe("SEA");
    expect(item.position).toBe("RB");
  });

  it("preserves an API-supplied player name", () => {
    const [item] = attachFantasyProsPlayerNames(
      [{ playerId: 23021, playerName: "Kenneth Walker III", team: "SEA", title: "" }],
      [{ playerId: 23021, name: "Another Name", team: "ATL", position: "WR" }],
    );
    expect(item.playerName).toBe("Kenneth Walker III");
  });
});
