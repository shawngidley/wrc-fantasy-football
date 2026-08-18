import { describe, expect, it } from "vitest";
import {
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026,
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA,
  findDraftUniversePlayer,
  getAvailableDraftUniversePlayers,
} from "@shared/draftPlayerUniverse";

describe("2026 WRC Draft player universe", () => {
  it("covers all NFL teams using validated active rosters and dated 2026 PPR ADP", () => {
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026).toHaveLength(1001);
    expect(new Set(CURRENT_DRAFT_PLAYER_UNIVERSE_2026.map(player => player.nflTeam)).size).toBe(32);
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(player => player.pos === "K")).toHaveLength(41);
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA.adpSource).toBe("Tank01 getNFLADP PPR");
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA.adpDate).toMatch(/^2026\d{4}$/);
  });

  it("includes representative 2026 drafted fantasy rookies, including the two Tank01 absences", () => {
    const rookies = [
      ["Fernando Mendoza", "QB", "LV"],
      ["Jeremiyah Love", "RB", "ARI"],
      ["Carnell Tate", "WR", "TEN"],
      ["Jordyn Tyson", "WR", "NO"],
      ["Kenyon Sadiq", "TE", "NYJ"],
      ["Max Bredeson", "TE", "MIN"],
      ["Riley Nowakowski", "TE", "PIT"],
    ] as const;

    rookies.forEach(([name, pos, nflTeam]) => {
      expect(findDraftUniversePlayer({ name, pos, nflTeam })).toMatchObject({ name, pos, nflTeam });
    });
  });

  it("excludes drafted and WRC-rostered players without hiding another eligible player", () => {
    const available = getAvailableDraftUniversePlayers({
      draftedNames: ["Fernando Mendoza"],
      rosteredNames: ["Jeremiyah Love"],
    });

    expect(available.some(player => player.name === "Fernando Mendoza")).toBe(false);
    expect(available.some(player => player.name === "Jeremiyah Love")).toBe(false);
    expect(available.some(player => player.name === "Carnell Tate")).toBe(true);
  });

  it("rejects a player not in the validated universe", () => {
    expect(findDraftUniversePlayer({ name: "Not A Player", pos: "QB", nflTeam: "TEST" })).toBeNull();
  });

  it("excludes retired players even when a stale upstream candidate record remains", () => {
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026.some(player => player.name === "Amari Cooper")).toBe(false);
    expect(findDraftUniversePlayer({ name: "Amari Cooper", pos: "WR", nflTeam: "LV" })).toBeNull();
  });
});
