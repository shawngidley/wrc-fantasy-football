import { describe, expect, it } from "vitest";
import type { DraftUniversePlayer } from "@shared/draftPlayerUniverse";
import { formatDraftBoardSeasonStat, resolve2026Adp, sortDraftBoardPlayers } from "./draftBoardPlayerBoard";
import { normalizeCompletedOffenseSeasonStats } from "./completedOffenseSeasonStats2025";

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

  it("sorts Queue, Bye, FPTS, and FP/G with unavailable values at the end", () => {
    const stats = {
      quarterback: { wrcPts: 180.2, ptsPerGame: 12.9 },
      receiver: { wrcPts: 208.4, ptsPerGame: 14.9 },
    };
    const queued = new Set(["runner"]);

    expect(sortDraftBoardPlayers(players, new Map(), "queue", "desc", stats, queued).map(player => player.name)).toEqual(["Runner", "Quarterback", "Receiver"]);
    expect(sortDraftBoardPlayers(players, new Map(), "bye", "asc", stats, queued).map(player => player.name)).toEqual(["Quarterback", "Runner", "Receiver"]);
    expect(sortDraftBoardPlayers(players, new Map(), "fpts", "desc", stats, queued).map(player => player.name)).toEqual(["Receiver", "Quarterback", "Runner"]);
    expect(sortDraftBoardPlayers(players, new Map(), "fpg", "asc", stats, queued).map(player => player.name)).toEqual(["Quarterback", "Receiver", "Runner"]);
  });

  it("formats completed-season FPTS and FP/G values while preserving loading and unavailable states", () => {
    expect(formatDraftBoardSeasonStat(178.45, false)).toBe("178.4");
    expect(formatDraftBoardSeasonStat(undefined, true)).toBe("…");
    expect(formatDraftBoardSeasonStat(undefined, false)).toBe("—");
  });

  it("uses WRC 1.5 PPR TE scoring for a reconciled completed-season veteran line", () => {
    const stats = normalizeCompletedOffenseSeasonStats({
      pos: "TE",
      passYds: 0,
      passTd: 0,
      passInt: 0,
      rushAtt: 0,
      rushYds: 0,
      rushTd: 0,
      rec: 56,
      recYds: 560,
      recTd: 2,
      fumblesLost: 0,
      returnTd: 0,
      games: 16,
    });

    expect(stats.wrcPts).toBe(152);
    expect(stats.ptsPerGame).toBe(9.5);
  });
});
