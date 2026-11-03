import { describe, expect, it } from "vitest";
import { TEAMS } from "@/lib/wrcData";
import { OWNER_TO_TEAM, SCHEDULE_2026 } from "@/lib/scheduleData2026";

// The schedule is built so teams in the same division meet twice and everyone
// else once. That makes it an independent check on the division lists.
describe("division membership", () => {
  const games = new Map<string, number>();
  for (const week of SCHEDULE_2026) {
    if (week.type !== "regular") continue;
    for (const [a, b] of week.matchups) {
      const key = [a, b].sort().join("|");
      games.set(key, (games.get(key) ?? 0) + 1);
    }
  }
  const meetTwice = (a: string, b: string) => (games.get([a, b].sort().join("|")) ?? 0) === 2;

  it("has four teams in each division", () => {
    for (const div of ["East", "Central", "West"] as const) {
      expect(TEAMS.filter(t => t.division === div)).toHaveLength(4);
    }
  });

  it("matches the schedule: division mates play twice, everyone else once", () => {
    for (const a of TEAMS) {
      for (const b of TEAMS) {
        if (a.id >= b.id) continue;
        expect({ pair: `${a.owner} v ${b.owner}`, twice: meetTwice(a.owner, b.owner) })
          .toEqual({ pair: `${a.owner} v ${b.owner}`, twice: a.division === b.division });
      }
    }
  });

  it("puts Keith in the East and Jamie in the Central", () => {
    expect(TEAMS.find(t => t.owner === "Keith")?.division).toBe("East");
    expect(TEAMS.find(t => t.owner === "Jamie")?.division).toBe("Central");
  });

  it("covers every owner in the schedule", () => {
    expect(TEAMS.map(t => t.owner).sort()).toEqual(Object.keys(OWNER_TO_TEAM).sort());
  });
});
