import { describe, expect, it } from "vitest";
import { extractFromGamelog } from "./useESPNSeasonStats";

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
