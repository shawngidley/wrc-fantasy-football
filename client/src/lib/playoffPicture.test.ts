import { describe, expect, it } from "vitest";
import { weeklyRecordDelta as serverWeeklyRecordDelta } from "../../../server/weeklyResultsFinalize";
import {
  buildBracket, clinchStatuses, finalRegularSeasonWeeks, magicNumbers, remainingSchedule, seedField, seedMovement, standingsThroughWeek, tiebreakNotes, weeklyRecordDelta,
  type Division, type ResultRow, type TeamLine,
} from "./playoffPicture";

const DIV: Division[] = ["East", "Central", "West"];
const teams = Array.from({ length: 12 }, (_, i) => ({ owner: `O${i}`, teamName: `Team ${i}`, division: DIV[Math.floor(i / 4)] }));

const line = (i: number, wins: number, ptsFor = 1000 + i): TeamLine => ({ ...teams[i], wins, losses: 0, ptsFor });

describe("weeklyRecordDelta", () => {
  it("matches the function that writes the official standings, for every combination", () => {
    for (const h2h of ["W", "L", "T"] as const) {
      for (const beat of [true, false]) {
        expect(weeklyRecordDelta(h2h, beat)).toEqual(serverWeeklyRecordDelta(h2h, beat));
      }
    }
  });
});

describe("standingsThroughWeek", () => {
  const row = (week: number, h: number, a: number, hs: number, as: number, is_final = true): ResultRow =>
    ({ week, home_owner: `O${h}`, away_owner: `O${a}`, home_score: hs, away_score: as, is_final });
  // Week 1: six games, scores 100..111, so the median is 105.5.
  const week1 = [row(1, 0, 1, 111, 110), row(1, 2, 3, 109, 108), row(1, 4, 5, 107, 106), row(1, 6, 7, 105, 104), row(1, 8, 9, 103, 102), row(1, 10, 11, 101, 100)];

  it("awards 2 for the head to head win and 1 for beating the median", () => {
    const lines = standingsThroughWeek(teams, week1, 14);
    const by = Object.fromEntries(lines.map(l => [l.owner, l]));
    expect(by.O0.wins).toBe(3); // won, above median
    expect(by.O1.wins).toBe(1); // lost, above median (110)
    expect(by.O6.wins).toBe(2); // won, below median (105 < 105.5)
    expect(by.O7.wins).toBe(0); // lost, below median
    expect(by.O0.ptsFor).toBe(111);
  });

  it("counts only final weeks up to the chosen week and ignores playoff weeks", () => {
    const rows = [...week1, row(2, 0, 1, 90, 80, false), row(15, 0, 1, 200, 10)];
    expect(standingsThroughWeek(teams, rows, 14).find(l => l.owner === "O0")?.wins).toBe(3);
    expect(standingsThroughWeek(teams, rows, 0).every(l => l.wins === 0)).toBe(true);
    expect(finalRegularSeasonWeeks(rows)).toEqual([1]);
  });
});

describe("seedField", () => {
  it("seeds 3 division winners first, then the 3 best other records, with byes for 1 and 2", () => {
    const wins = [20, 18, 17, 5, /* Central */ 25, 22, 10, 9, /* West */ 12, 21, 19, 3];
    const field = seedField(wins.map((w, i) => line(i, w)));
    expect(field.seeds.map(s => s.line.owner)).toEqual(["O4", "O9", "O0", "O5", "O10", "O1"]);
    expect(field.seeds.map(s => s.kind)).toEqual(["division", "division", "division", "wildcard", "wildcard", "wildcard"]);
    expect(field.seeds.map(s => s.bye)).toEqual([true, true, false, false, false, false]);
    expect(field.rest).toHaveLength(6);
  });

  it("breaks a tie on wins with points for", () => {
    const lines = teams.map((t, i) => ({ ...t, wins: 10, losses: 0, ptsFor: i === 3 ? 5000 : 1000 + i }));
    expect(seedField(lines).seeds[0].line.owner).toBe("O3");
  });
});

describe("clinchStatuses", () => {
  it("clinches a division only when no division mate can catch up", () => {
    // O0 leads East by 5 with 2 weeks left (6 wins possible for a chaser): not clinched.
    const base = [20, 15, 10, 9, 25, 22, 10, 9, 12, 21, 19, 3].map((w, i) => line(i, w));
    expect(clinchStatuses(base, 2).get("O0")).not.toBe("division");
    // With 1 week left (3 wins possible) a 5 win lead is safe.
    expect(clinchStatuses(base, 1).get("O0")).toBe("division");
  });

  it("eliminates a team that cannot reach the playoff line even by winning out", () => {
    const wins = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0];
    const status = clinchStatuses(wins.map((w, i) => line(i, w)), 2);
    expect(status.get("O11")).toBe("eliminated");
    expect(status.get("O0")).not.toBe("eliminated");
  });

  it("uses the final standings once the regular season is over", () => {
    const wins = [20, 18, 17, 5, 25, 22, 10, 9, 12, 21, 19, 3];
    const status = clinchStatuses(wins.map((w, i) => line(i, w)), 0);
    expect(status.get("O4")).toBe("division");
    expect(status.get("O1")).toBe("playoff");
    expect(status.get("O11")).toBe("eliminated");
  });

  it("never claims a clinch or elimination that some outcome could undo (random check)", () => {
    let seed = 12345;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let trial = 0; trial < 60; trial++) {
      const left = 1 + Math.floor(rand() * 3);
      const lines = teams.map((t, i) => ({ ...t, wins: Math.floor(rand() * 12), losses: 0, ptsFor: Math.floor(rand() * 2000) + i / 100 }));
      const status = clinchStatuses(lines, left);
      for (let outcome = 0; outcome < 400; outcome++) {
        const finals = lines.map(l => ({ ...l, wins: l.wins + Math.floor(rand() * (3 * left + 1)) }));
        const field = seedField(finals);
        const inField = new Set(field.seeds.map(s => s.line.owner));
        const winners = new Set(field.seeds.filter(s => s.kind === "division").map(s => s.line.owner));
        status.forEach((value, owner) => {
          if (value === "division") expect(winners.has(owner)).toBe(true);
          if (value === "playoff") expect(inField.has(owner)).toBe(true);
          if (value === "eliminated") expect(inField.has(owner)).toBe(false);
        });
      }
    }
  });
});

describe("seedMovement", () => {
  it("reports how many seeds a team moved, and nothing when there is no earlier week", () => {
    const wins = [20, 18, 17, 5, 25, 22, 10, 9, 12, 21, 19, 3];
    const now = seedField(wins.map((w, i) => line(i, w))).seeds;
    const earlier = seedField(wins.map((w, i) => line(i, i === 9 ? w - 3 : w))).seeds;
    const moved = seedMovement(earlier, now);
    expect(moved.get("O9")).toEqual({ previousSeed: 5, change: 3 });
    expect(seedMovement(null, now).get("O9")).toEqual({ previousSeed: null, change: 0 });
  });
});

describe("buildBracket", () => {
  const wins = [20, 18, 17, 5, 25, 22, 10, 9, 12, 21, 19, 3];
  const seeds = seedField(wins.map((w, i) => line(i, w))).seeds;
  const owner = (n: number) => seeds[n - 1].line.owner;
  const game = (week: number, a: number, b: number, sa: number, sb: number, is_final = true): ResultRow =>
    ({ week, home_owner: owner(a), away_owner: owner(b), home_score: sa, away_score: sb, is_final });

  it("starts with 3 v 6 and 4 v 5 and no scores", () => {
    const [wc1, wc2, sf1] = buildBracket(seeds, []);
    expect([wc1.top.seed, wc1.bottom.seed]).toEqual([3, 6]);
    expect([wc2.top.seed, wc2.bottom.seed]).toEqual([4, 5]);
    expect(sf1.top.seed).toBe(1);
    expect(sf1.bottom.label).toBe("Lowest remaining seed");
  });

  it("sends the top seed against the lowest remaining seed", () => {
    // Seeds 6 and 5 win, so seed 1 plays 6 and seed 2 plays 5.
    const rows = [game(15, 3, 6, 100, 110), game(15, 4, 5, 90, 95)];
    const [, , sf1, sf2] = buildBracket(seeds, rows);
    expect([sf1.top.seed, sf1.bottom.seed]).toEqual([1, 6]);
    expect([sf2.top.seed, sf2.bottom.seed]).toEqual([2, 5]);
  });

  it("sends the top seed to the lowest remaining seed when the favorites win", () => {
    // Seeds 3 and 4 win, so seed 1 plays 4 and seed 2 plays 3.
    const rows = [game(15, 3, 6, 120, 100), game(15, 4, 5, 120, 100)];
    const [, , sf1, sf2] = buildBracket(seeds, rows);
    expect([sf1.top.seed, sf1.bottom.seed]).toEqual([1, 4]);
    expect([sf2.top.seed, sf2.bottom.seed]).toEqual([2, 3]);
  });

  it("does not name a winner until the game is final, and a tie goes to the better seed", () => {
    const live = buildBracket(seeds, [game(15, 3, 6, 50, 60, false)])[0];
    expect(live.final).toBe(false);
    expect(live.winnerSeed).toBeNull();
    expect(live.bottom.score).toBe(60);
    const tied = buildBracket(seeds, [game(15, 3, 6, 100, 100)])[0];
    expect(tied.winnerSeed).toBe(3);
  });

  it("fills the championship from the two semifinal winners", () => {
    const rows = [
      game(15, 3, 6, 120, 100), game(15, 4, 5, 120, 100),
      game(16, 1, 4, 130, 100), game(16, 2, 3, 100, 140),
    ];
    const final = buildBracket(seeds, rows)[4];
    expect([final.top.seed, final.bottom.seed]).toEqual([1, 3]);
  });

  it("returns no games if there are fewer than six seeds", () => {
    expect(buildBracket(seeds.slice(0, 4), [])).toEqual([]);
  });
});

describe("magicNumbers", () => {
  const wins = [20, 15, 10, 9, 25, 22, 10, 9, 12, 21, 19, 3];
  const lines = wins.map((w, i) => line(i, w));

  it("agrees with clinchStatuses: the clinch number is the fewest extra wins that flips a team to clinched", () => {
    const left = 3;
    const magic = magicNumbers(lines, left);
    for (const team of lines) {
      const toClinch = magic.get(team.owner)?.toClinch;
      if (toClinch === null || toClinch === undefined) continue;
      const withExtra = (extra: number) => lines.map(l => (l.owner === team.owner ? { ...l, wins: l.wins + extra } : l));
      const clinched = (extra: number) => {
        const status = clinchStatuses(withExtra(extra), left).get(team.owner);
        return status === "division" || status === "playoff";
      };
      expect(clinched(toClinch)).toBe(true);
      if (toClinch > 0) expect(clinched(toClinch - 1)).toBe(false);
    }
  });

  it("is zero for a team that has already clinched", () => {
    expect(magicNumbers(lines, 1).get("O4")?.toClinch).toBe(0);
  });

  it("says a team can't stay alive when it is already out", () => {
    const hopeless = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0].map((w, i) => line(i, w));
    expect(magicNumbers(hopeless, 2).get("O11")?.toStayAlive).toBeNull();
    expect(magicNumbers(hopeless, 2).get("O0")?.toStayAlive).toBe(0);
  });

  it("asks for more wins to stay alive the further a team is behind", () => {
    const behind = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 14].map((w, i) => line(i, w));
    const alive = magicNumbers(behind, 3).get("O11")?.toStayAlive;
    expect(alive).not.toBeNull();
    expect(alive).toBeGreaterThan(0);
  });
});

describe("tiebreakNotes", () => {
  it("names who wins a tie on wins and by how many points, for teams competing for the same spot", () => {
    // O1 and O5 are both wild cards on 22 wins; O5 has more points.
    const w = [30, 22, 10, 9, 30, 22, 10, 9, 30, 8, 7, 6];
    const field = seedField(w.map((x, i) => line(i, x, i === 5 ? 1500 : 1000 + i)));
    const notes = tiebreakNotes(field);
    expect(notes.get("O5")).toMatch(/Ahead on points by 499\.0/);
    expect(notes.get("O1")).toMatch(/Behind on points by 499\.0/);
  });

  it("does not compare a division winner with a wild card from another division", () => {
    // O9 wins the West on 21; O0 is East winner on 21 too: both division winners, so noted.
    // O1 (wild card, 21) is NOT noted against O9, because a division winner always outranks a wild card.
    const w = [21, 21, 10, 9, 30, 12, 10, 9, 12, 21, 11, 3];
    const field = seedField(w.map((x, i) => line(i, x, 1000 + i)));
    const notes = tiebreakNotes(field);
    expect(notes.has("O4")).toBe(false);
    expect(notes.get("O0")).toMatch(/O9|Team 9|Team 1/);
  });

  it("notes a division winner tied with a division mate", () => {
    const w = [20, 20, 10, 9, 25, 12, 10, 9, 12, 21, 11, 3];
    const field = seedField(w.map((x, i) => line(i, x, i === 0 ? 2000 : 1000 + i)));
    expect(tiebreakNotes(field).get("O0")).toMatch(/Team 1/);
  });
});

describe("remainingSchedule", () => {
  const schedule = [
    { week: 1, type: "regular", matchups: [["O0", "O1"]] as const },
    { week: 2, type: "regular", matchups: [["O0", "O2"]] as const },
    { week: 3, type: "regular", matchups: [["O3", "O0"]] as const },
    { week: 15, type: "wildcard", matchups: [["TBD", "TBD"]] as const },
  ];
  const lines = [line(0, 6), { ...line(1, 6), losses: 0 }, { ...line(2, 3), losses: 3 }, { ...line(3, 0), losses: 6 }];

  it("lists only the weeks still to play, home or away, and skips the playoffs", () => {
    const r = remainingSchedule(schedule, lines, 1).get("O0");
    expect(r?.opponents).toEqual(["O2", "O3"]);
  });

  it("averages the opponents' records, and is null when none have played", () => {
    // O2 is 3-3 and O3 is 0-6: 3 wins in 12 games.
    expect(remainingSchedule(schedule, lines, 1).get("O0")?.opponentWinPct).toBeCloseTo(3 / 12);
    expect(remainingSchedule(schedule, [line(0, 0), line(2, 0), line(3, 0)], 1).get("O0")?.opponentWinPct).toBeNull();
    expect(remainingSchedule(schedule, lines, 14).get("O0")?.opponents).toEqual([]);
  });
});
