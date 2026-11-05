import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEDULE_2026, applyPlayoffMatchups, type ScheduleWeek } from "../client/src/lib/scheduleData2026";
import { TEAMS } from "../client/src/lib/wrcData";

// An in-memory stand-in for the three tables playoff setup touches.
const db = vi.hoisted(() => ({
  weekly_results: [] as Record<string, unknown>[],
  earnings: [] as Record<string, unknown>[],
  teams: [] as Record<string, unknown>[],
  nextId: 1,
}));

vi.mock("./supabaseAdmin", () => {
  function table(name: "weekly_results" | "earnings" | "teams") {
    const filters: Array<[string, unknown]> = [];
    const matches = () => db[name].filter(row => filters.every(([k, v]) => row[k] === v));
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
      order: () => builder,
      maybeSingle: () => Promise.resolve({ data: matches()[0] ?? null, error: null }),
      insert: (rows: Record<string, unknown>[]) => {
        for (const row of rows) db[name].push({ id: db.nextId++, ...row });
        return Promise.resolve({ error: null });
      },
      upsert: (row: Record<string, unknown>) => {
        const i = db[name].findIndex(r => r.id === row.id);
        if (i >= 0) db[name][i] = row; else db[name].push(row);
        return Promise.resolve({ error: null });
      },
      then: (resolve: (value: unknown) => unknown) => resolve({ data: matches(), error: null }),
    };
    return builder;
  }
  return { supabaseAdmin: { from: (name: "weekly_results" | "earnings" | "teams") => table(name) } };
});

import { buildPlayoffRow, ensurePlayoffRounds, planPlayoffRounds } from "./playoffSetup";
import { creditPrizeOnce } from "./prizeEarnings";

const teamId = (owner: string) => owner.toLowerCase().replace(/[^a-z]/g, "");
const playoffTeams = TEAMS.map(t => ({ owner: t.owner, teamName: t.teamName, division: t.division }));

/** Every regular season game, final, with a score that gives each team a distinct total. */
function regularSeasonRows(weeks = 14) {
  const rows: Record<string, unknown>[] = [];
  const strength = new Map(TEAMS.map((t, i) => [t.owner, 100 + ((i * 7) % 12) * 3]));
  for (const week of SCHEDULE_2026.filter(w => w.type === "regular" && w.week <= weeks)) {
    for (const [home, away] of week.matchups) {
      rows.push({
        id: db.nextId++, week: week.week, season: 2026, home_owner: home, away_owner: away,
        home_team_id: teamId(home), away_team_id: teamId(away),
        home_team_name: `${home} team`, away_team_name: `${away} team`,
        home_score: (strength.get(home) ?? 100) + week.week / 10, away_score: (strength.get(away) ?? 100) + week.week / 10,
        is_final: true, league_median: 110, dates: week.dates,
      });
    }
  }
  return rows;
}

function seedDb(weeks = 14) {
  db.nextId = 1;
  db.weekly_results = regularSeasonRows(weeks);
  db.earnings = [];
  db.teams = TEAMS.map(t => ({ owner: t.owner, name: t.teamName, division: t.division }));
}

const playoffRows = () => db.weekly_results.filter(r => (r.week as number) > 14);
const finalize = (week: number, winnerIsHome = true) => {
  for (const row of playoffRows().filter(r => r.week === week)) {
    row.home_score = winnerIsHome ? 130 : 90;
    row.away_score = winnerIsHome ? 90 : 130;
    row.is_final = true;
  }
};
const earningFor = (owner: string, column: string) => db.earnings.find(e => e.id === teamId(owner))?.[column];

describe("planPlayoffRounds", () => {
  beforeEach(() => seedDb());

  it("waits until all 14 regular season weeks are final", () => {
    seedDb(13);
    expect(planPlayoffRounds(playoffTeams, db.weekly_results as never)).toEqual({ gamesToCreate: [], prizes: [] });
  });

  it("creates the two Wild Card games, 3 v 6 and 4 v 5, and pays all six qualifiers for reaching the round", () => {
    const plan = planPlayoffRounds(playoffTeams, db.weekly_results as never);
    expect(plan.gamesToCreate).toHaveLength(2);
    expect(plan.gamesToCreate.every(g => g.week === 15)).toBe(true);
    expect(plan.prizes.filter(p => p.column === "wild_card")).toHaveLength(6);
    expect(plan.prizes.filter(p => p.column !== "wild_card")).toHaveLength(0);
  });

  it("does not create a round that already has games", () => {
    db.weekly_results.push(...[
      { id: 900, week: 15, season: 2026, home_owner: "A", away_owner: "B", is_final: false },
      { id: 901, week: 15, season: 2026, home_owner: "C", away_owner: "D", is_final: false },
    ]);
    expect(planPlayoffRounds(playoffTeams, db.weekly_results as never).gamesToCreate).toEqual([]);
  });
});

describe("ensurePlayoffRounds, start to finish", () => {
  beforeEach(() => seedDb());

  it("builds the whole playoff run, one round at a time, and pays each prize once", async () => {
    // Seeds lock: Week 15 appears, the six qualifiers each get $50.
    await ensurePlayoffRounds(2026);
    expect(playoffRows().map(r => r.week)).toEqual([15, 15]);
    const owners = new Set(playoffRows().flatMap(r => [r.home_owner, r.away_owner]));
    expect(owners.size).toBe(4); // seeds 1 and 2 have the bye
    expect(db.earnings.filter(e => e.wild_card === 50)).toHaveLength(6);
    const wcRow = playoffRows()[0];
    expect(wcRow).toMatchObject({ season: 2026, is_final: false, home_score: null, league_median: null, dates: "Dec. 17–21" });
    expect(wcRow.home_team_id).toBe(teamId(wcRow.home_owner as string));

    // Running it again changes nothing and pays nothing twice.
    await ensurePlayoffRounds(2026);
    expect(playoffRows()).toHaveLength(2);
    expect(db.earnings.filter(e => e.wild_card === 50)).toHaveLength(6);

    // Wild Card final: Week 16 appears and four teams get $100.
    finalize(15);
    await ensurePlayoffRounds(2026);
    expect(playoffRows().filter(r => r.week === 16)).toHaveLength(2);
    expect(db.earnings.filter(e => e.divisional === 100)).toHaveLength(4);

    // Divisional final: the Super Bowl appears and both finalists get $300.
    finalize(16);
    await ensurePlayoffRounds(2026);
    const finalRow = playoffRows().find(r => r.week === 17);
    expect(finalRow).toBeTruthy();
    expect(db.earnings.filter(e => e.super_bowl === 300)).toHaveLength(2);
    expect(db.earnings.some(e => e.champ != null)).toBe(false);

    // Super Bowl final: the winner gets $600, exactly once.
    finalize(17);
    await ensurePlayoffRounds(2026);
    await ensurePlayoffRounds(2026);
    expect(db.earnings.filter(e => e.champ === 600)).toHaveLength(1);
    expect(earningFor(finalRow!.home_owner as string, "champ")).toBe(600); // home team (better seed) won
    expect(playoffRows()).toHaveLength(5);
  });

  it("in Week 16 the top seed plays the lowest remaining seed", async () => {
    await ensurePlayoffRounds(2026);
    // Both lower seeds win (the away team in each game).
    finalize(15, false);
    await ensurePlayoffRounds(2026);
    const wcWinners = playoffRows().filter(r => r.week === 15).map(r => r.away_owner as string);
    const semis = playoffRows().filter(r => r.week === 16);
    const opponents = semis.flatMap(r => [r.home_owner as string, r.away_owner as string]).filter(o => wcWinners.includes(o));
    expect(opponents.sort()).toEqual([...wcWinners].sort());
  });

  it("never pays a prize that already has an amount, such as one entered by hand", async () => {
    const someOwner = TEAMS[0].owner;
    db.earnings.push({ id: teamId(someOwner), name: someOwner, season: 2026, wild_card: 25, gow: null, divisional: null, super_bowl: null, champ: null });
    await ensurePlayoffRounds(2026);
    expect(earningFor(someOwner, "wild_card")).toBe(25);
  });
});

describe("buildPlayoffRow", () => {
  const template = { id: 5, created_at: "x", week: 1, season: 2026, home_owner: "A", away_owner: "B", home_team_id: "a", away_team_id: "b", home_team_name: "Aa", away_team_name: "Bb", home_score: 100, away_score: 90, is_final: true, league_median: 95, dates: "Sept. 9-14", extra: "keep" };
  const names = new Map([["X", "Team X"], ["Y", "Team Y"]]);
  const ids = new Map([["X", "x"], ["Y", "y"]]);

  it("copies the template, drops its id and scores, and sets the game fields", () => {
    const row = buildPlayoffRow(template, { week: 16, home_owner: "X", away_owner: "Y" }, 2026, names, ids);
    expect(row).toMatchObject({ week: 16, home_owner: "X", away_owner: "Y", home_team_id: "x", away_team_id: "y", home_team_name: "Team X", away_team_name: "Team Y", home_score: null, away_score: null, is_final: false, league_median: null, dates: "Dec. 24–28", extra: "keep" });
    expect("id" in row).toBe(false);
    expect("created_at" in row).toBe(false);
  });

  it("does not invent columns the table doesn't have", () => {
    const slim = { week: 1, season: 2026, home_owner: "A", away_owner: "B", home_score: 1, away_score: 2, is_final: true, league_median: 3 };
    const row = buildPlayoffRow(slim, { week: 15, home_owner: "X", away_owner: "Y" }, 2026, names, ids);
    expect(Object.keys(row).sort()).toEqual(Object.keys(slim).sort());
  });

  it("refuses to build a row for a team it has no id for", () => {
    expect(() => buildPlayoffRow(template, { week: 15, home_owner: "X", away_owner: "Nobody" }, 2026, names, ids)).toThrow(/Nobody/);
  });
});

describe("creditPrizeOnce", () => {
  beforeEach(() => seedDb());
  it("pays once, then skips", async () => {
    expect(await creditPrizeOnce("Greg", "champ", 2026)).toBe(true);
    expect(await creditPrizeOnce("Greg", "champ", 2026)).toBe(false);
    expect(earningFor("Greg", "champ")).toBe(600);
  });
});

describe("applyPlayoffMatchups", () => {
  const fresh = (): ScheduleWeek[] => JSON.parse(JSON.stringify(SCHEDULE_2026));

  it("fills in real games, keeps their order, and never touches the regular season", () => {
    const schedule = fresh();
    const regularBefore = JSON.stringify(schedule.filter(w => w.type === "regular"));
    const changed = applyPlayoffMatchups(schedule, [
      { week: 15, home_owner: "Dan", away_owner: "Bill" },
      { week: 15, home_owner: "Jamie", away_owner: "Greg" },
    ]);
    expect(changed).toBe(true);
    expect(schedule.find(w => w.week === 15)?.matchups).toEqual([["Dan", "Bill"], ["Jamie", "Greg"]]);
    expect(schedule.find(w => w.week === 16)?.matchups).toEqual([["TBD", "TBD"], ["TBD", "TBD"]]);
    expect(JSON.stringify(schedule.filter(w => w.type === "regular"))).toBe(regularBefore);
  });

  it("reports no change when nothing is different, and goes back to TBD if the games are gone", () => {
    const schedule = fresh();
    expect(applyPlayoffMatchups(schedule, [])).toBe(false);
    applyPlayoffMatchups(schedule, [{ week: 17, home_owner: "Dan", away_owner: "Bill" }]);
    expect(applyPlayoffMatchups(schedule, [{ week: 17, home_owner: "Dan", away_owner: "Bill" }])).toBe(false);
    expect(applyPlayoffMatchups(schedule, [])).toBe(true);
    expect(schedule.find(w => w.week === 17)?.matchups).toEqual([["TBD", "TBD"]]);
  });
});
