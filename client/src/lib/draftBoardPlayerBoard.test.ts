import { describe, expect, it } from "vitest";
import type { DraftUniversePlayer } from "@shared/draftPlayerUniverse";
import { resolve2026Adp, sortDraftBoardPlayers } from "./draftBoardPlayerBoard";

const players: DraftUniversePlayer[] = [
  { id: "qb", name: "Quarterback", pos: "QB", nflTeam: "BUF", adp: 35.4, bye: 7, sourcePlayerId: "1" },
  { id: "rb", name: "Runner", pos: "RB", nflTeam: "ARI", adp: 9999, bye: 8, sourcePlayerId: "2" },
  { id: "wr", name: "Receiver", pos: "WR", nflTeam: "DET", adp: 19.2, bye: 9, sourcePlayerId: "3" },
];

describe("Draft Board player table", () => {
  it("prefers current 2026 Tank01 ADP and leaves unranked players unavailable", () => {
    const liveAdp = new Map([["runner", 12.7]]);

    expect(resolve2026Adp(players[0], liveAdp)).toBe(35.4);
    expect(resolve2026Adp(players[1], liveAdp)).toBe(12.7);
    expect(resolve2026Adp(players[1], new Map())).toBeNull();
  });

  it("sorts the default board by ADP while placing unranked players last", () => {
    const ordered = sortDraftBoardPlayers(players, new Map([["runner", 12.7]]), "adp", "asc");
    expect(ordered.map(player => player.name)).toEqual(["Runner", "Receiver", "Quarterback"]);

    const unrankedLast = sortDraftBoardPlayers(players, new Map(), "adp", "asc");
    expect(unrankedLast.map(player => player.name)).toEqual(["Receiver", "Quarterback", "Runner"]);
  });

  it("sorts by position when owners choose the Position header", () => {
    const ordered = sortDraftBoardPlayers([players[2], players[1], players[0]], new Map(), "pos", "asc");
    expect(ordered.map(player => player.pos)).toEqual(["QB", "RB", "WR"]);
  });
});
