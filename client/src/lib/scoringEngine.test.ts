import { describe, expect, it } from "vitest";
import { calcFantasyPoints, buildStatChips } from "./scoringEngine";
import { DST_SEASON_STATS_2025 } from "./dstSeasonStats2025";

describe("calcFantasyPoints", () => {
  it("applies the published WRC QB, rushing, receiving, and lost-fumble rules", () => {
    const points = calcFantasyPoints({
      Passing: { passYds: 250, passTD: 2, int: 1, passingTwoPointConversion: 1 },
      Rushing: { rushYds: 20, rushTD: 1, rushingTwoPointConversion: 1 },
      Receiving: { receptions: 3, recYds: 30, recTD: 1, receivingTwoPointConversion: 1 },
      Fumbles: { fumblesLost: 1 },
    }, "RB");
    expect(points).toBe(37);
  });

  it("uses TE premium, return touchdowns, and a single lost-fumble value", () => {
    const points = calcFantasyPoints({
      Receiving: { receptions: 4, recYds: 50, recTD: 1 },
      Defense: { fumblesLost: 1, returnTD: 1 },
      Fumbles: { fumblesLost: 1 },
    }, "TE");
    expect(points).toBe(20);
  });

  it("counts a combined D/ST touchdown total once and excludes D/ST fumble-loss penalties", () => {
    const points = calcFantasyPoints({
      Defense: { sacks: 2, defensiveInterceptions: 1, fumblesRecovered: 1, defTD: 1, returnTD: 1, defensiveOrSpecialTeamsTds: 2, safeties: 1, fumblesLost: 9 },
    }, "DST");
    expect(points).toBe(24);
  });

  it("reconciles Cleveland and the Chargers D/ST FPTS and FP/G from completed 2025 totals", () => {
    const score = (team: "CLE" | "LAC") => {
      const line = DST_SEASON_STATS_2025[team];
      return calcFantasyPoints({ Defense: {
        sacks: line.sacks,
        defensiveInterceptions: line.defInt,
        fumblesRecovered: line.fumblesRecovered,
        defensiveOrSpecialTeamsTds: line.dstTD,
        safeties: line.safeties,
      } }, "DST");
    };

    expect(score("CLE")).toBe(184);
    expect(score("CLE") / DST_SEASON_STATS_2025.CLE.games).toBeCloseTo(10.8, 1);
    expect(score("LAC")).toBe(161);
    expect(score("LAC") / DST_SEASON_STATS_2025.LAC.games).toBeCloseTo(9.5, 1);
  });
});

describe("buildStatChips", () => {
  it("returns an empty array for a player with no stats yet", () => {
    expect(buildStatChips({})).toEqual([]);
  });

  it("builds passing chips, omitting TD/INT when zero", () => {
    expect(buildStatChips({ Passing: { passYds: "248", passTD: "2", int: "0" } })).toEqual([
      { label: "YDS", value: 248 },
      { label: "TD", value: 2 },
    ]);
  });

  it("includes INT when present", () => {
    expect(buildStatChips({ Passing: { passYds: "180", passTD: "1", int: "2" } })).toEqual([
      { label: "YDS", value: 180 },
      { label: "TD", value: 1 },
      { label: "INT", value: 2, negative: true },
    ]);
  });

  it("builds rushing chips", () => {
    expect(buildStatChips({ Rushing: { rushYds: "84", rushTD: "1", carries: "18" } })).toEqual([
      { label: "RUSH", value: 84 },
      { label: "TD", value: 1 },
    ]);
  });

  it("builds a mobile QB's combined passing and rushing chips", () => {
    expect(buildStatChips({
      Passing: { passYds: "220", passTD: "2", int: "0" },
      Rushing: { rushYds: "45", rushTD: "1", carries: "6" },
    })).toEqual([
      { label: "YDS", value: 220 },
      { label: "TD", value: 2 },
      { label: "RUSH", value: 45 },
      { label: "TD", value: 1 },
    ]);
  });

  it("builds receiving chips even with a scoreless target (0 receptions)", () => {
    expect(buildStatChips({ Receiving: { receptions: "0", recYds: "0", recTD: "0", targets: "3" } })).toEqual([]);
  });

  it("builds receiving chips with actual production", () => {
    expect(buildStatChips({ Receiving: { receptions: "6", recYds: "84", recTD: "1" } })).toEqual([
      { label: "REC", value: 6 },
      { label: "YDS", value: 84 },
      { label: "TD", value: 1 },
    ]);
  });

  it("builds kicking chips as made/attempted fractions", () => {
    expect(buildStatChips({ Kicking: { fgMade: "2", fgAttempts: "3", xpMade: "4", xpAttempts: "4" } })).toEqual([
      { label: "FG", value: "2/3" },
      { label: "XP", value: "4/4" },
    ]);
  });

  it("builds defense chips, omitting zero categories", () => {
    expect(buildStatChips({ Defense: { sacks: "2", defensiveInterceptions: "1", fumblesRecovered: "0", safeties: "0", defTD: "1" } })).toEqual([
      { label: "SACK", value: 2 },
      { label: "INT", value: 1 },
      { label: "TD", value: 1 },
    ]);
  });

  it("returns an empty array for an all-zero defense line", () => {
    expect(buildStatChips({ Defense: { sacks: "0", defensiveInterceptions: "0", fumblesRecovered: "0", safeties: "0", defTD: "0" } })).toEqual([]);
  });
});

describe("DST sacks parsing (Tank01's actual field shape)", () => {
  it("parses sacks from the combined sacksAndYardsLost field (e.g. '3-10' -> 3 sacks)", () => {
    const points = calcFantasyPoints({
      Defense: { sacksAndYardsLost: "3-10" },
    }, "DST");
    expect(points).toBe(6); // 3 sacks * 2
  });

  it("prefers a plain sacks field over sacksAndYardsLost if both are present", () => {
    const points = calcFantasyPoints({
      Defense: { sacks: 5, sacksAndYardsLost: "3-10" },
    }, "DST");
    expect(points).toBe(10); // 5 sacks * 2, not 3
  });

  it("treats a missing sacks field (no sacks, no sacksAndYardsLost) as 0 sacks", () => {
    const points = calcFantasyPoints({
      Defense: { defensiveInterceptions: 1 },
    }, "DST");
    expect(points).toBe(3); // just the interception, no sack contribution
  });
});

describe("DST has no points-allowed category (confirmed with commissioner)", () => {
  it("does not add any points-allowed bonus regardless of game context", () => {
    // Only sack/fumble-interception/touchdown/safety exist -- no fourth
    // parameter or opponent-score input affects this at all anymore.
    const points = calcFantasyPoints({ Defense: { safeties: 1 } }, "DST");
    expect(points).toBe(2); // just the safety
  });
});

describe("buildStatChips negative-event flagging", () => {
  it("marks a thrown interception (offensive) as negative", () => {
    const chips = buildStatChips({ Passing: { passYds: 250, passTD: 2, int: 1 } });
    const intChip = chips.find(c => c.label === "INT");
    expect(intChip?.negative).toBe(true);
  });

  it("does NOT mark a defensive interception (DST) as negative -- it's a positive event", () => {
    const chips = buildStatChips({ Defense: { defensiveInterceptions: 1 } });
    const intChip = chips.find(c => c.label === "INT");
    expect(intChip?.negative).toBeFalsy();
  });

  it("shows a FUM chip (previously missing entirely) for an offensive fumble lost, marked negative", () => {
    const chips = buildStatChips({ Fumbles: { fumblesLost: 1 } });
    const fumChip = chips.find(c => c.label === "FUM");
    expect(fumChip).toBeDefined();
    expect(fumChip?.value).toBe(1);
    expect(fumChip?.negative).toBe(true);
  });

  it("falls back to Defense.fumblesLost when Fumbles.fumblesLost isn't present -- matches calcFantasyPoints' existing fallback, since Tank01 sometimes reports it there instead", () => {
    // Confirmed live: T. Shough's displayed score (20.2) already
    // correctly reflected a -3 fumble-lost deduction (410yd*.04 +
    // 3TD*4 - 2INT*3 + 8rush*.1 = 23.2, minus 3 for the lost fumble =
    // 20.2), meaning calcFantasyPoints found the fumble -- but the FUM
    // chip wasn't showing, because buildStatChips lacked this same
    // fallback and Tank01 had reported it under Defense for this player.
    const chips = buildStatChips({ Defense: { fumblesLost: 1 } });
    const fumChip = chips.find(c => c.label === "FUM");
    expect(fumChip).toBeDefined();
    expect(fumChip?.value).toBe(1);
    expect(fumChip?.negative).toBe(true);
  });

  it("no longer shows a defensive fumble recovery (FR) as a chip at all, per request", () => {
    const chips = buildStatChips({ Defense: { fumblesRecovered: 1 } });
    expect(chips.find(c => c.label === "FR")).toBeUndefined();
  });

  it("does not show a FUM chip at all when there's no fumble lost", () => {
    const chips = buildStatChips({ Rushing: { rushYds: 50, carries: 10 } });
    expect(chips.find(c => c.label === "FUM")).toBeUndefined();
  });
});
