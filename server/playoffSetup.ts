import { supabaseAdmin } from "./supabaseAdmin";
import { creditPrizeOnce, type PrizeColumn } from "./prizeEarnings";
import {
  REGULAR_SEASON_WEEKS,
  buildBracket,
  finalRegularSeasonWeeks,
  seedField,
  standingsThroughWeek,
  type Division,
  type PlayoffTeam,
  type ResultRow,
} from "../client/src/lib/playoffPicture";
import { SCHEDULE_2026 } from "../client/src/lib/scheduleData2026";

/**
 * Playoff setup. Once the 14 regular season weeks are final, the six seeds are
 * known, so the Week 15 games are created. Each later round is created as soon
 * as the one before it is final: Week 16 once both Wild Card games are done,
 * Week 17 once both Divisional games are done.
 *
 * "Creating a game" means adding a weekly_results row, so scoring, Live
 * Scoring, the schedule and the finalizer all treat it like any other week.
 *
 * Prizes are paid when a team reaches a round, which is the league's published
 * structure on the Money page: Wild Card 6 x $50, Divisional 4 x $100, Super
 * Bowl 2 x $300, Champion 1 x $600. Each is paid once only.
 */

export interface PlannedPlayoffGame {
  week: number;
  home_owner: string;
  away_owner: string;
}

export interface PlannedPrize {
  owner: string;
  column: PrizeColumn;
}

export interface PlayoffPlan {
  gamesToCreate: PlannedPlayoffGame[];
  prizes: PlannedPrize[];
}

const GAMES_IN_WEEK: Record<number, number> = { 15: 2, 16: 2, 17: 1 };

/** Decides what is missing. Pure: no database access. */
export function planPlayoffRounds(teams: readonly PlayoffTeam[], rows: readonly ResultRow[]): PlayoffPlan {
  const empty: PlayoffPlan = { gamesToCreate: [], prizes: [] };
  if (finalRegularSeasonWeeks(rows).length < REGULAR_SEASON_WEEKS) return empty;

  const seeds = seedField(standingsThroughWeek(teams, rows, REGULAR_SEASON_WEEKS)).seeds;
  if (seeds.length < 6) return empty;

  const games = buildBracket(seeds, rows);
  const weeksWithGames = new Set(rows.filter(r => r.week > REGULAR_SEASON_WEEKS).map(r => r.week));

  const gamesToCreate: PlannedPlayoffGame[] = [];
  for (const week of [15, 16, 17]) {
    if (weeksWithGames.has(week)) continue; // a round is created all at once, and never again
    const ready = games
      .filter(g => g.week === week && g.top.owner && g.bottom.owner)
      .map(g => ({ week, home_owner: g.top.owner as string, away_owner: g.bottom.owner as string }));
    if (ready.length === GAMES_IN_WEEK[week]) gamesToCreate.push(...ready);
  }

  const prizes: PlannedPrize[] = [];
  const reached = (column: PrizeColumn, owners: (string | null)[]) => {
    for (const owner of owners) if (owner) prizes.push({ owner, column });
  };
  // Every qualifier reaches the Wild Card round, including the two byes.
  reached("wild_card", seeds.map(s => s.line.owner));
  const sfGames = games.filter(g => g.round === "semifinal");
  if (sfGames.every(g => g.top.owner && g.bottom.owner)) {
    reached("divisional", sfGames.flatMap(g => [g.top.owner, g.bottom.owner]));
  }
  const final = games.find(g => g.round === "final");
  if (final && final.top.owner && final.bottom.owner) {
    reached("super_bowl", [final.top.owner, final.bottom.owner]);
    if (final.final && final.winnerSeed !== null) {
      reached("champ", [final.winnerSeed === final.top.seed ? final.top.owner : final.bottom.owner]);
    }
  }
  return { gamesToCreate, prizes };
}

type StoredRow = ResultRow & Record<string, unknown>;

/**
 * Builds a full weekly_results row for a planned game. It copies an existing
 * row and replaces only the game fields, so any column this code doesn't know
 * about still gets a sensible value, and the team id format matches the rows
 * the standings already read.
 */
export function buildPlayoffRow(
  template: Record<string, unknown>,
  game: PlannedPlayoffGame,
  season: number,
  teamNameByOwner: ReadonlyMap<string, string>,
  teamIdByOwner: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...template };
  for (const key of ["id", "created_at", "updated_at"]) delete row[key];
  const setIfPresent = (key: string, value: unknown) => { if (key in template) row[key] = value; };
  const idOf = (owner: string) => {
    const id = teamIdByOwner.get(owner);
    if (!id) throw new Error(`No team id is on file for ${owner}.`);
    return id;
  };
  const nameOf = (owner: string) => {
    const name = teamNameByOwner.get(owner);
    if (!name) throw new Error(`No team name is on file for ${owner}.`);
    return name;
  };
  Object.assign(row, {
    week: game.week, season,
    home_owner: game.home_owner, away_owner: game.away_owner,
    home_score: null, away_score: null, is_final: false, league_median: null,
  });
  setIfPresent("home_team_id", idOf(game.home_owner));
  setIfPresent("away_team_id", idOf(game.away_owner));
  setIfPresent("home_team_name", nameOf(game.home_owner));
  setIfPresent("away_team_name", nameOf(game.away_owner));
  setIfPresent("dates", SCHEDULE_2026.find(w => w.week === game.week)?.dates ?? null);
  return row;
}

/**
 * Creates any playoff games that are now due and pays any prizes that are now
 * earned. Safe to run as often as you like: a round that already has games is
 * left alone, and a prize that already has an amount on the Money page is
 * skipped (so a prize you entered by hand is never doubled).
 */
export async function ensurePlayoffRounds(season: number) {
  const [teamsResult, rowsResult] = await Promise.all([
    supabaseAdmin.from("teams").select("owner, name, division"),
    supabaseAdmin.from("weekly_results").select("*").eq("season", season).order("id"),
  ]);
  if (teamsResult.error || !teamsResult.data) throw new Error(`Unable to load teams for playoff setup: ${teamsResult.error?.message ?? "no data"}`);
  if (rowsResult.error || !rowsResult.data) throw new Error(`Unable to load weekly results for playoff setup: ${rowsResult.error?.message ?? "no data"}`);

  const teams: PlayoffTeam[] = teamsResult.data.map(t => ({ owner: t.owner as string, teamName: t.name as string, division: t.division as Division }));
  const rows = rowsResult.data as StoredRow[];
  const plan = planPlayoffRounds(teams, rows);

  if (plan.gamesToCreate.length > 0) {
    const template = rows.find(r => r.week <= REGULAR_SEASON_WEEKS);
    if (!template) throw new Error("No regular season row to copy for the playoff games.");
    const teamNameByOwner = new Map(teams.map(t => [t.owner, t.teamName]));
    const teamIdByOwner = new Map<string, string>();
    for (const row of rows) {
      if (typeof row.home_team_id === "string") teamIdByOwner.set(row.home_owner, row.home_team_id);
      if (typeof row.away_team_id === "string") teamIdByOwner.set(row.away_owner, row.away_team_id);
    }
    const newRows = plan.gamesToCreate.map(game => buildPlayoffRow(template, game, season, teamNameByOwner, teamIdByOwner));
    const { error } = await supabaseAdmin.from("weekly_results").insert(newRows);
    if (error) throw new Error(`Unable to create the playoff games: ${error.message}`);
    console.log(`[playoffSetup] created ${newRows.length} playoff game(s): ${plan.gamesToCreate.map(g => `wk${g.week} ${g.home_owner} v ${g.away_owner}`).join("; ")}`);
  }

  const paid: string[] = [];
  for (const prize of plan.prizes) {
    if (await creditPrizeOnce(prize.owner, prize.column, season)) paid.push(`${prize.owner}:${prize.column}`);
  }
  if (paid.length > 0) console.log(`[playoffSetup] paid ${paid.join(", ")}`);
  return { created: plan.gamesToCreate, paid };
}
