import { describe, expect, it } from "vitest";
import { clearObsoleteHistoryCaches, extractFromGamelog, extractFromSeasonTotals, getPrimarySeasonTeam } from "./useESPNSeasonStats";

describe("extractFromGamelog", () => {
  it("keeps a receiving-first tight end's historical stats in the correct columns", () => {
    const labels = ["REC", "TGTS", "YDS", "AVG", "TD", "LNG", "CAR", "YDS", "AVG", "LNG", "TD", "FUM", "LST"];
    const totals = {
      REC: 111, TGTS: 147, YDS_0: 1146, TD_0: 2,
      CAR: 1, YDS_1: 6, TD_1: 0, LST: 1,
    };

    expect(extractFromGamelog(totals, 16, labels)).toMatchObject({
      rec: 111, recTargets: 147, recYds: 1146, recTD: 2, recAvg: 10.3,
      rushAtt: 1, rushYds: 6, rushTD: 0, fumblesLost: 1,
    });
  });

  it("keeps a rushing-first running back's rushing and receiving totals in their own groups", () => {
    const labels = ["CAR", "YDS", "AVG", "TD", "LNG", "REC", "TGTS", "YDS", "AVG", "TD", "LNG", "FUM", "LST"];
    const totals = {
      CAR: 345, YDS_0: 2005, TD_0: 13,
      REC: 33, TGTS: 43, YDS_1: 278, TD_1: 2,
    };

    expect(extractFromGamelog(totals, 16, labels)).toMatchObject({
      rushAtt: 345, rushYds: 2005, rushTD: 13, rushAvg: 5.8,
      rec: 33, recTargets: 43, recYds: 278, recTD: 2, recAvg: 8.4,
    });
  });

  it("keeps a quarterback's passing and rushing stat groups separate", () => {
    const labels = ["CMP", "ATT", "YDS", "CMP%", "AVG", "TD", "INT", "CAR", "YDS", "AVG", "TD"];
    const totals = { CMP: 307, ATT: 483, YDS_0: 3731, TD_0: 28, INT: 6, CAR: 102, YDS_1: 531, TD_1: 12 };
    expect(extractFromGamelog(totals, 17, labels)).toMatchObject({
      passCmp: 307, passAtt: 483, passYds: 3731, passTD: 28, passInt: 6,
      rushAtt: 102, rushYds: 531, rushTD: 12,
    });
  });

  it("maps kicker and defense stat labels through the same shared parser", () => {
    expect(extractFromGamelog({ FGM: 30, FGA: 35, XPM: 28, XPA: 29 }, 17, ["FGM", "FGA", "FG%", "XPM", "XPA"])).toMatchObject({
      fgMade: 30, fgAtt: 35, fgPct: 85.7, xpMade: 28, xpAtt: 29,
    });
    expect(extractFromGamelog({ SACK: 41, INT: 15, FR: 8, TD: 3 }, 17, ["SACK", "INT", "FR", "TD"])).toMatchObject({
      sacks: 41, defInt: 15, fumblesRecovered: 8, defTD: 3,
    });
  });
});

describe("clearObsoleteHistoryCaches", () => {
  it("removes older historical-stat cache schemas but preserves the current schema", () => {
    const values = new Map([
      ["wrc_espn_gl_v2_4361307_2024", "old"],
      ["wrc_espn_gl_v3_4361307_2024", "old"],
      ["wrc_espn_gl_v8_4361307_2024", "current"],
      ["unrelated", "keep"],
    ]);
    const storage = {
      get length() { return values.size; },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => values.delete(key),
    };

    clearObsoleteHistoryCaches(storage);

    expect(values.has("wrc_espn_gl_v2_4361307_2024")).toBe(false);
    expect(values.has("wrc_espn_gl_v3_4361307_2024")).toBe(false);
    expect(values.has("wrc_espn_gl_v8_4361307_2024")).toBe(true);
    expect(values.has("unrelated")).toBe(true);
  });
});

describe("getPrimarySeasonTeam", () => {
  it("uses the team shown on the majority of a player’s season game entries", () => {
    const events = [{ eventId: "one" }, { eventId: "two" }, { eventId: "three" }];
    const metadata = {
      one: { team: { abbreviation: "GB" } },
      two: { team: { abbreviation: "GB" } },
      three: { team: { abbreviation: "NYJ" } },
    };
    expect(getPrimarySeasonTeam(events, metadata)).toBe("GB");
  });
});

describe("extractFromSeasonTotals", () => {
  it("uses ESPN’s veteran season totals when a game-log endpoint has no events", () => {
    const categories = [
      { name: "receiving", labels: ["GP", "REC", "TGTS", "YDS", "AVG", "TD"], statistics: [
        { teamId: "13", season: { year: 2024 }, stats: ["3", "18", "27", "209", "11.6", "1"] },
        { teamId: "20", season: { year: 2024 }, stats: ["11", "67", "114", "854", "12.7", "7"] },
        { displayName: "2024 Totals", season: { year: 2024 }, stats: ["14", "85", "141", "1063", "12.5", "8"] },
      ] },
    ];
    const teams = { "las-vegas-raiders": { id: "13", abbreviation: "LV" }, "new-york-jets": { id: "20", abbreviation: "NYJ" } };
    expect(extractFromSeasonTotals(categories, teams, 2024)).toMatchObject({
      team: "NYJ", gp: 14, rec: 85, recTargets: 141, recYds: 1063, recAvg: 12.5, recTD: 8,
    });
  });
});
