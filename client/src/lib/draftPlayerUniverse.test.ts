import { describe, expect, it } from "vitest";
import {
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026,
  CURRENT_DRAFT_PLAYER_UNIVERSE_2026_METADATA,
  findDraftUniversePlayer,
  getAvailableDraftUniversePlayers,
} from "@shared/draftPlayerUniverse";

describe("2026 WRC Draft player universe", () => {
  it("covers all NFL teams using validated active rosters and dated 2026 PPR ADP", () => {
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026).toHaveLength(1003);
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

  // Players added by hand after the 2026-08-18 snapshot, for a signing the
  // daily nflverse refresh cannot introduce (it only updates the team and bye
  // of players already present). A regeneration of the pool would silently drop
  // them, taking them back out of Free Agents and making them unbiddable, since
  // submitFaabBid validates against this same universe.
  it("keeps the manually added post-snapshot signings", () => {
    expect(findDraftUniversePlayer({ name: "Brandin Cooks", pos: "WR", nflTeam: "SF" }))
      .toMatchObject({ name: "Brandin Cooks", pos: "WR", nflTeam: "SF", bye: 8 });
  });

  // No 2026 PPR ADP exists for a player the snapshot never saw, so they carry
  // the 9999 sentinel every other unranked entry uses -- below 9999 is read as a
  // real ADP and displayed as one (draftBoardPlayerBoard, DraftRecap).
  it("gives a post-snapshot signing the unranked-ADP sentinel", () => {
    const cooks = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(player => player.name === "Brandin Cooks");
    expect(cooks?.adp).toBe(9999);
  });

  it("rejects a player not in the validated universe", () => {
    expect(findDraftUniversePlayer({ name: "Not A Player", pos: "QB", nflTeam: "TEST" })).toBeNull();
  });

  it("excludes retired players even when a stale upstream candidate record remains", () => {
    expect(CURRENT_DRAFT_PLAYER_UNIVERSE_2026.some(player => player.name === "Amari Cooper")).toBe(false);
    expect(findDraftUniversePlayer({ name: "Amari Cooper", pos: "WR", nflTeam: "LV" })).toBeNull();
  });

  it("assigns every Jacksonville player the verified 2026 Week 7 bye", () => {
    const jaguars = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.filter(player => player.nflTeam === "JAC");
    expect(jaguars.length).toBeGreaterThan(0);
    expect(jaguars.every(player => player.bye === 7)).toBe(true);
  });
});
