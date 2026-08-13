import { describe, expect, it } from "vitest";
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";

describe("attachFantasyProsPlayerNames", () => {
  it("uses the FantasyPros player ID when generic news omits player_name", () => {
    const [item] = attachFantasyProsPlayerNames(
      [{ playerId: 23021, playerName: "", title: "Kenneth Walker III primed for workhorse role" }],
      [{ playerId: 23021, name: "Kenneth Walker III" }],
    );
    expect(item.playerName).toBe("Kenneth Walker III");
  });

  it("preserves an API-supplied player name", () => {
    const [item] = attachFantasyProsPlayerNames(
      [{ playerId: 23021, playerName: "Kenneth Walker III", title: "" }],
      [{ playerId: 23021, name: "Another Name" }],
    );
    expect(item.playerName).toBe("Kenneth Walker III");
  });
});
