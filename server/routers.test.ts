import { describe, expect, it } from "vitest";
import { aggregateWeeklyStatRows } from "./routers";

describe("aggregateWeeklyStatRows", () => {
  it("sums basic counting stats across multiple weeks", () => {
    const rows = [
      { gp: 1, rush_att: 20, rush_yds: 100, rush_td: 1, wrc_pts: 14.0 },
      { gp: 1, rush_att: 15, rush_yds: 80, rush_td: 0, wrc_pts: 8.0 },
    ];
    const result = aggregateWeeklyStatRows(rows);
    expect(result.gp).toBe(2);
    expect(result.rushAtt).toBe(35);
    expect(result.rushYds).toBe(180);
    expect(result.rushTD).toBe(1);
    expect(result.wrcPts).toBe(22.0);
  });

  it("averages passRating only across weeks with pass attempts, not every week", () => {
    // A RB with a single trick-play pass attempt in one week shouldn't
    // have their (very different) rushing-heavy weeks drag down or
    // otherwise distort a passRating average that should only reflect
    // actual passing weeks.
    const rows = [
      { gp: 1, pass_att: 30, pass_rating: 95.0 },
      { gp: 1, pass_att: 0, pass_rating: 0 }, // no passing this week -- shouldn't count toward the average
      { gp: 1, pass_att: 25, pass_rating: 105.0 },
    ];
    const result = aggregateWeeklyStatRows(rows);
    expect(result.passRating).toBe(100.0); // average of 95 and 105, not all three
  });

  it("computes ptsPerGame from games actually played (gp), not the number of weekly rows", () => {
    // A bye week or a week the player didn't play still gets a row
    // (gp=0) -- it shouldn't count toward the games-played denominator.
    const rows = [
      { gp: 1, wrc_pts: 20.0 },
      { gp: 0, wrc_pts: 0 }, // bye week / did not play
      { gp: 1, wrc_pts: 10.0 },
    ];
    const result = aggregateWeeklyStatRows(rows);
    expect(result.gp).toBe(2);
    expect(result.wrcPts).toBe(30.0);
    expect(result.ptsPerGame).toBe(15.0); // 30 / 2, not 30 / 3
  });

  it("returns all zeros for an empty rows array", () => {
    const result = aggregateWeeklyStatRows([]);
    expect(result.gp).toBe(0);
    expect(result.wrcPts).toBe(0);
    expect(result.ptsPerGame).toBe(0);
    expect(result.passRating).toBe(0);
  });

  it("sums DST-specific fields correctly", () => {
    const rows = [
      { gp: 1, sacks: 3, def_int: 1, fumbles_recovered: 1, def_td: 0, wrc_pts: 15.0 },
      { gp: 1, sacks: 2, def_int: 0, fumbles_recovered: 0, def_td: 1, wrc_pts: 10.0 },
    ];
    const result = aggregateWeeklyStatRows(rows);
    expect(result.sacks).toBe(5);
    expect(result.defInt).toBe(1);
    expect(result.fumblesRecovered).toBe(1);
    expect(result.defTD).toBe(1);
    expect(result.wrcPts).toBe(25.0);
  });

  it("handles missing/null field values as 0 rather than throwing or producing NaN", () => {
    const rows = [{ gp: 1 }];
    const result = aggregateWeeklyStatRows(rows);
    expect(result.rushYds).toBe(0);
    expect(result.wrcPts).toBe(0);
    expect(Number.isNaN(result.ptsPerGame)).toBe(false);
  });
});
