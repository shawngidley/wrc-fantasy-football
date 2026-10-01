import { describe, it, expect } from "vitest";
import { normalizeTankSeasonStats } from "./playerSeasonStats";
import { calcFantasyPoints, type Tank01Stats } from "./scoringEngine";

/**
 * The stored sacks stat and the WRC points scored off the same stat line have to
 * agree. Tank01 usually sends a defense's sacks only inside the combined
 * "sacksAndYardsLost" string, and scoring reads it through sacksFrom -- so a
 * stored stat read from a bare defense.sacks silently landed at 0 while the
 * points counted the sacks.
 */
describe("normalizeTankSeasonStats: D/ST sacks", () => {
  it("reads sacks out of the combined sacksAndYardsLost string", () => {
    const stats = { Defense: { sacksAndYardsLost: "3-10" } } as Tank01Stats;
    expect(normalizeTankSeasonStats(stats, "DST").sacks).toBe(3);
  });

  it("still prefers a plain sacks field when one is present", () => {
    // attributeOffenseFramedDefenseStats writes the opponent's sacks here, which
    // is the correct credit for this defense; it must win over the combined
    // string it also rewrites.
    const stats = { Defense: { sacks: 2, sacksAndYardsLost: "3-10" } } as unknown as Tank01Stats;
    expect(normalizeTankSeasonStats(stats, "DST").sacks).toBe(2);
  });

  it("agrees with the points scored off the same stat line", () => {
    const stats = { Defense: { sacksAndYardsLost: "4-27" } } as Tank01Stats;
    const normalized = normalizeTankSeasonStats(stats, "DST");
    expect(normalized.sacks).toBe(4);
    // 4 sacks x 2 pts is the only scoring category in this line.
    expect(normalized.wrcPts).toBe(calcFantasyPoints(stats, "DST"));
    expect(normalized.wrcPts).toBe(8);
  });

  it("is 0 when the defense reported no sacks either way", () => {
    expect(normalizeTankSeasonStats({ Defense: {} } as Tank01Stats, "DST").sacks).toBe(0);
    expect(normalizeTankSeasonStats(undefined, "DST").sacks).toBe(0);
  });
});
