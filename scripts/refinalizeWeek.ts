/**
 * Re-finalize one week's official results, with a before/after diff.
 *
 * Weekly settlement normally runs itself (the Vercel cron hits
 * /api/scheduled/weekly-results-finalize, which only picks up weeks that still
 * have a non-final row). This script is for the other case: a week that is
 * already final needs recomputing because the scoring code changed.
 *
 * It prints the week's weekly_results rows, league_median, every team's
 * standings line, the Rivalry Game earnings column and the week's
 * rivalry_games rows; then, only with --run, re-finalizes and prints the same
 * again plus a diff of everything that moved.
 *
 * Usage (from the repo root, with the real env):
 *   SUPABASE_SERVICE_ROLE_KEY=... TANK01_API_KEY=... \
 *     ./node_modules/.bin/tsx scripts/refinalizeWeek.ts 6 2026          # dry run: prints current state only
 *   SUPABASE_SERVICE_ROLE_KEY=... TANK01_API_KEY=... \
 *     ./node_modules/.bin/tsx scripts/refinalizeWeek.ts 6 2026 --run    # actually re-finalizes
 *
 * Re-finalizing is safe to repeat: scores are recomputed from the box scores,
 * recomputeStandingsFromFinalizedResults rebuilds the standings from every
 * finalized week rather than incrementing, and the rivalry payout is skipped
 * for any rivalry_games row already marked resolved -- which is exactly why a
 * rivalry game whose WINNER changes needs a manual earnings correction. The
 * script says so when it detects one.
 */
import { supabaseAdmin } from "../server/supabaseAdmin";
import { finalizeWeeklyResultsFromTank } from "../server/weeklyResultsFinalize";
import { earningsIdForOwner, PRIZE_AMOUNTS } from "../server/prizeEarnings";

const week = Number(process.argv[2]);
const season = Number(process.argv[3]);
const doRun = process.argv.includes("--run");

if (!Number.isInteger(week) || week < 1 || week > 22 || !Number.isInteger(season)) {
  console.error("Usage: tsx scripts/refinalizeWeek.ts <week> <season> [--run]");
  process.exit(1);
}
const missing = ["SUPABASE_SERVICE_ROLE_KEY", "TANK01_API_KEY"].filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(", ")}`);
  console.error("Both are needed: the service-role key to read and write, and the Tank01 key to re-read the week's box scores.");
  process.exit(1);
}

type ResultRow = {
  home_owner: string; away_owner: string;
  home_score: number | null; away_score: number | null;
  is_final: boolean; league_median: number | null;
};
type StandingRow = {
  team_name: string; owner: string;
  wins: number; losses: number; ties: number;
  median_wins: number; median_losses: number;
};
type EarningsRow = { id: string; name: string | null; gow: number | null };
type RivalryRow = { id: string; team_id: string; opponent_team_id: string; week: number; resolved: boolean; declared_at: string | null };

const matchupKey = (r: ResultRow) => `${r.home_owner} vs ${r.away_owner}`;
const fmt = (v: number | null) => (v === null || v === undefined ? "—" : String(v));

async function snapshot() {
  const [results, standings, earnings] = await Promise.all([
    supabaseAdmin.from("weekly_results")
      .select("home_owner, away_owner, home_score, away_score, is_final, league_median")
      .eq("season", season).eq("week", week).order("home_owner"),
    supabaseAdmin.from("team_standings")
      .select("team_name, owner, wins, losses, ties, median_wins, median_losses").order("owner"),
    supabaseAdmin.from("earnings").select("id, name, gow").order("id"),
  ]);
  for (const [label, res] of [["weekly_results", results], ["team_standings", standings], ["earnings", earnings]] as const) {
    if (res.error) throw new Error(`Unable to read ${label}: ${res.error.message}`);
  }
  return {
    results: (results.data ?? []) as ResultRow[],
    standings: (standings.data ?? []) as StandingRow[],
    earnings: (earnings.data ?? []) as EarningsRow[],
  };
}

function printSnapshot(label: string, snap: Awaited<ReturnType<typeof snapshot>>) {
  console.log(`\n===== ${label} =====`);
  console.log(`\nweekly_results, week ${week}:`);
  for (const r of snap.results) {
    console.log(`  ${matchupKey(r).padEnd(26)} ${fmt(r.home_score).padStart(7)} - ${fmt(r.away_score).padEnd(7)} final=${r.is_final}  median=${fmt(r.league_median)}`);
  }
  const medians = Array.from(new Set(snap.results.map(r => r.league_median)));
  console.log(`  league_median on the rows: ${medians.map(fmt).join(", ") || "none"}`);
  console.log(`\nteam_standings:`);
  console.log(`  ${"owner".padEnd(10)} ${"team".padEnd(26)} ${"W-L-T".padEnd(9)} median W-L`);
  for (const s of snap.standings) {
    console.log(`  ${s.owner.padEnd(10)} ${s.team_name.padEnd(26)} ${`${s.wins}-${s.losses}-${s.ties}`.padEnd(9)} ${s.median_wins}-${s.median_losses}`);
  }
  console.log(`\nearnings (Rivalry Game column):`);
  for (const e of snap.earnings) {
    if (e.gow) console.log(`  ${(e.name ?? e.id).padEnd(12)} gow=$${e.gow}`);
  }
}

/** The week's rivalry declarations, resolved state, and who the $30 went to. */
async function printRivalry(results: ResultRow[]) {
  const [{ data: rivalries, error: rivalryError }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("rivalry_games").select("id, team_id, opponent_team_id, week, resolved, declared_at").eq("season", season).eq("week", week),
    supabaseAdmin.from("teams").select("id, owner, name"),
  ]);
  if (rivalryError) throw new Error(`Unable to read rivalry_games: ${rivalryError.message}`);
  if (teamsError || !teams) throw new Error(`Unable to read teams: ${teamsError?.message}`);
  const ownerById = new Map(teams.map(t => [t.id as string, t.owner as string]));

  console.log(`\n===== rivalry_games, week ${week} =====`);
  const rows = (rivalries ?? []) as RivalryRow[];
  if (rows.length === 0) {
    console.log("  none declared for this week -- no rivalry payout is involved.");
    return;
  }
  for (const r of rows) {
    const declarer = ownerById.get(r.team_id) ?? r.team_id;
    const opponent = ownerById.get(r.opponent_team_id) ?? r.opponent_team_id;
    const match = results.find(res =>
      (res.home_owner === declarer && res.away_owner === opponent) ||
      (res.home_owner === opponent && res.away_owner === declarer));
    const current = match
      ? (match.home_score === match.away_score ? "tied (no payout)"
        : `${(match.home_score ?? 0) > (match.away_score ?? 0) ? match.home_owner : match.away_owner} leads/won`)
      : "no weekly_results row found";
    console.log(`  ${declarer} vs ${opponent}  resolved=${r.resolved}  declared_at=${r.declared_at ?? "—"}`);
    console.log(`      current result: ${current}`);
    if (r.resolved) {
      console.log(`      ALREADY RESOLVED: the $${PRIZE_AMOUNTS.gow} was credited to that winner's earnings.gow and`);
      console.log(`      this re-run will NOT re-credit it (the payout query filters resolved=false).`);
      console.log(`      If the winner changes below, correct it by hand in earnings.gow:`);
      console.log(`        -$${PRIZE_AMOUNTS.gow} from id="${earningsIdForOwner(declarer)}" or "${earningsIdForOwner(opponent)}" (the old winner),`);
      console.log(`        +$${PRIZE_AMOUNTS.gow} to the new winner. Never money_owed -- that table is league fees only.`);
    }
  }
}

function printDiff(before: Awaited<ReturnType<typeof snapshot>>, after: Awaited<ReturnType<typeof snapshot>>) {
  console.log(`\n===== DIFF =====`);
  let changes = 0;

  console.log(`\nscores:`);
  for (const a of after.results) {
    const b = before.results.find(r => r.home_owner === a.home_owner && r.away_owner === a.away_owner);
    const scoreChanged = !b || b.home_score !== a.home_score || b.away_score !== a.away_score;
    const winner = (r: ResultRow) => r.home_score === r.away_score ? "tie" : ((r.home_score ?? 0) > (r.away_score ?? 0) ? r.home_owner : r.away_owner);
    if (scoreChanged) {
      changes++;
      console.log(`  ${matchupKey(a)}`);
      console.log(`    before ${fmt(b?.home_score ?? null)} - ${fmt(b?.away_score ?? null)}  winner: ${b ? winner(b) : "—"}`);
      console.log(`    after  ${fmt(a.home_score)} - ${fmt(a.away_score)}  winner: ${winner(a)}${b && winner(b) !== winner(a) ? "   <-- WINNER FLIPPED" : ""}`);
    }
  }
  if (changes === 0) console.log("  (no score changed)");

  const beforeMedian = before.results.find(r => r.league_median !== null)?.league_median ?? null;
  const afterMedian = after.results.find(r => r.league_median !== null)?.league_median ?? null;
  console.log(`\nleague_median: ${fmt(beforeMedian)} -> ${fmt(afterMedian)}${beforeMedian !== afterMedian ? "  <-- CHANGED" : "  (unchanged)"}`);

  console.log(`\nstandings:`);
  let standingChanges = 0;
  for (const a of after.standings) {
    const b = before.standings.find(s => s.owner === a.owner);
    if (!b) continue;
    const fields: Array<keyof StandingRow> = ["wins", "losses", "ties", "median_wins", "median_losses"];
    const moved = fields.filter(f => b[f] !== a[f]);
    if (moved.length > 0) {
      standingChanges++;
      console.log(`  ${a.owner.padEnd(10)} ${moved.map(f => `${f}: ${b[f]} -> ${a[f]}`).join(", ")}`);
    }
  }
  if (standingChanges === 0) console.log("  (no standings row changed)");

  console.log(`\nearnings.gow:`);
  let earningsChanges = 0;
  for (const a of after.earnings) {
    const b = before.earnings.find(e => e.id === a.id);
    if ((b?.gow ?? null) !== (a.gow ?? null)) {
      earningsChanges++;
      console.log(`  ${(a.name ?? a.id).padEnd(12)} ${fmt(b?.gow ?? null)} -> ${fmt(a.gow ?? null)}`);
    }
  }
  if (earningsChanges === 0) console.log("  (unchanged -- expected: an already-resolved rivalry game is never re-paid)");
}

async function main() {
  const before = await snapshot();
  if (before.results.length === 0) {
    console.error(`No weekly_results rows exist for week ${week}, season ${season}. Nothing to re-finalize.`);
    process.exit(1);
  }
  printSnapshot(`BEFORE (week ${week}, ${season})`, before);
  await printRivalry(before.results);

  if (!doRun) {
    console.log(`\nDry run. Re-run with --run to actually re-finalize week ${week}.`);
    return;
  }

  console.log(`\n>>> re-finalizing week ${week}, ${season} ...`);
  const result = await finalizeWeeklyResultsFromTank(week, season);
  console.log(`>>> done: ${JSON.stringify(result)}`);

  const after = await snapshot();
  printSnapshot(`AFTER (week ${week}, ${season})`, after);
  await printRivalry(after.results);
  printDiff(before, after);
}

main().catch(error => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
