import { describe, expect, it } from "vitest";
import { clearObsoleteHistoryCaches, extractFromGamelog } from "./useESPNSeasonStats";

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
});

describe("clearObsoleteHistoryCaches", () => {
  it("removes older historical-stat cache schemas but preserves the current schema", () => {
    const values = new Map([
      ["wrc_espn_gl_v2_4361307_2024", "old"],
      ["wrc_espn_gl_v3_4361307_2024", "old"],
      ["wrc_espn_gl_v4_4361307_2024", "current"],
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
    expect(values.has("wrc_espn_gl_v4_4361307_2024")).toBe(true);
    expect(values.has("unrelated")).toBe(true);
  });
});
