/**
 * READ-ONLY audit of the two 2026 scoring defects, and whether either changed a
 * result. SELECTs only -- it never updates weekly_results, team_standings,
 * earnings or anything else. Nothing it prints has been applied.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/auditKickerDuplicateFgWeeks.ts
 *
 * 1. DUPLICATE FIELD GOALS (fixed in code by 4da203f + 3e28b28). ESPN writes two
 *    real field goals of the same distance by the same kicker with byte-identical
 *    play text; the old parser deduped on that text and dropped the second. WRC
 *    scores a FG at 0.1/yd, so a dropped kick is worth yards/10. Only field goals
 *    can move a finalized score: finalization passes Tank01 rawStats, so extra
 *    points come from xpMade/xpAttempts and never from parsed text.
 *
 * 2. SPECIAL-TEAMS RETURN TOUCHDOWNS (not yet fixed). WRC's published rules give
 *    a D/ST +6 for a "Defensive/ST Touchdown", and scoringEngine's DST branch
 *    would credit one, but nothing supplies it for 2026: Tank01's team-defense
 *    block carries only defensive scores. The 2025 static dataset had to take
 *    return touchdowns from nflverse play-by-play for exactly this reason.
 *
 * Both lists were produced by replaying every completed 2026 regular-season game
 * through the live ESPN feed -- the kicker rows by running the old and new
 * parsers side by side, the return touchdowns by scanning scoringPlays.
 */
import { supabaseAdmin } from "../server/supabaseAdmin";
import { normalizePlayerName } from "../shared/playerNameMatch";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "../shared/currentDraftPlayerUniverse2026";

const SEASON = 2026;

type AffectedKicker = { week: number; game: string; kicker: string; nflTeam: string; old: number; now: number; delta: number };
type AffectedDst = { week: number; nflTeam: string; play: string; delta: number };

const AFFECTED_KICKERS: AffectedKicker[] = [
  { week: 2, game: "CLE @ TB", kicker: "Chase McLaughlin", nflTeam: "TB", old: 13.5, now: 16.6, delta: 3.1 },
  { week: 2, game: "CLE @ TB", kicker: "Andre Szmyt", nflTeam: "CLE", old: 8.4, now: 11.8, delta: 3.4 },
  { week: 3, game: "TEN @ NYG", kicker: "Dominic Zvada", nflTeam: "NYG", old: 9.6, now: 13.5, delta: 3.9 },
  { week: 4, game: "NYJ @ CHI", kicker: "Cairo Santos", nflTeam: "CHI", old: 5.1, now: 8.1, delta: 3.0 },
  { week: 4, game: "KC @ LV", kicker: "Matt Gay", nflTeam: "LV", old: 16.5, now: 21.3, delta: 4.8 },
  { week: 5, game: "BAL @ ATL", kicker: "Tyler Loop", nflTeam: "BAL", old: 7.2, now: 12.3, delta: 5.1 },
  { week: 6, game: "NYJ @ NE", kicker: "Jason Sanders", nflTeam: "NYJ", old: 11.8, now: 15.4, delta: 3.6 },
  { week: 9, game: "DET @ MIA", kicker: "Zane Gonzalez", nflTeam: "MIA", old: 6.6, now: 10.0, delta: 3.4 },
  { week: 9, game: "NYG @ PHI", kicker: "Dominic Zvada", nflTeam: "NYG", old: 14.0, now: 18.9, delta: 4.9 },
  { week: 10, game: "LAR @ ARI", kicker: "Chad Ryland", nflTeam: "ARI", old: 4.9, now: 9.8, delta: 4.9 },
  { week: 10, game: "SF @ DAL", kicker: "Brandon Aubrey", nflTeam: "DAL", old: 5.2, now: 10.4, delta: 5.2 },
  { week: 11, game: "MIA @ BUF", kicker: "Daniel Carlson", nflTeam: "MIA", old: 7.9, now: 13.1, delta: 5.2 },
];

const AFFECTED_DST: AffectedDst[] = [
  { week: 3, nflTeam: "MIN", play: "Myles Price 86 Yd Punt Return", delta: 6 },
  { week: 6, nflTeam: "TEN", play: "Oluwafemi Oladejo 14 Yd return of blocked punt", delta: 6 },
  { week: 8, nflTeam: "LV", play: "Dylan Laube 95 Yd Kickoff Return", delta: 6 },
  { week: 11, nflTeam: "BAL", play: "Devontez Walker 86 Yd Kickoff Return", delta: 6 },
];

/** The draft pool's name for a team defense, e.g. LV -> "LV Raiders". */
function dstPoolName(nflTeam: string): string | null {
  const entry = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(p => p.pos === "DST" && p.nflTeam === nflTeam);
  return entry?.name ?? null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type LineupRow = { team_id: string; slot: string; player_name: string; is_bench: boolean | null };

async function main() {
  const { data: teams, error: teamsError } = await supabaseAdmin.from("teams").select("id, owner, name");
  if (teamsError || !teams) throw new Error(`Unable to load teams: ${teamsError?.message}`);
  const ownerById = new Map(teams.map(t => [String(t.id), String(t.owner)]));

  const weeks = Array.from(new Set([...AFFECTED_KICKERS.map(a => a.week), ...AFFECTED_DST.map(a => a.week)])).sort((a, b) => a - b);

  // lineups is historical (keyed by week), so it still resolves a player who has
  // since been dropped -- which matters, since most of these kickers were
  // one-week streams.
  const lineupsByWeek = new Map<number, LineupRow[]>();
  for (const week of weeks) {
    const { data, error } = await supabaseAdmin.from("lineups")
      .select("team_id, slot, player_name, is_bench")
      .eq("season", SEASON).eq("week", week);
    if (error) throw new Error(`Unable to load week ${week} lineups: ${error.message}`);
    lineupsByWeek.set(week, (data ?? []) as LineupRow[]);
  }

  // Combined, so a week carrying both corrections moves the median once with
  // both applied -- a median shift can flip a team that neither correction
  // touched directly.
  const deltasByWeekOwner = new Map<string, number>();
  const addDelta = (week: number, owner: string, delta: number) => {
    const key = `${week}|${owner}`;
    deltasByWeekOwner.set(key, r1((deltasByWeekOwner.get(key) ?? 0) + delta));
  };

  function startersFor(week: number, name: string): LineupRow[] {
    const key = normalizePlayerName(name);
    return (lineupsByWeek.get(week) ?? [])
      .filter(r => normalizePlayerName(String(r.player_name ?? "")) === key && !r.is_bench);
  }

  console.log("=== 1. Duplicate field goals: who started the kicker ===\n");
  for (const a of AFFECTED_KICKERS) {
    const starters = startersFor(a.week, a.kicker);
    if (starters.length === 0) {
      const benched = (lineupsByWeek.get(a.week) ?? []).some(r => normalizePlayerName(String(r.player_name ?? "")) === normalizePlayerName(a.kicker));
      console.log(`wk${String(a.week).padStart(2)}  ${a.kicker.padEnd(18)} +${a.delta.toFixed(1).padStart(4)}  -> ${benched ? "on a bench, not started" : "no saved starter row"}`);
      continue;
    }
    for (const s of starters) {
      const owner = ownerById.get(String(s.team_id)) ?? `team ${s.team_id}`;
      console.log(`wk${String(a.week).padStart(2)}  ${a.kicker.padEnd(18)} +${a.delta.toFixed(1).padStart(4)}  -> ${owner}  (${a.old} -> ${a.now})`);
      addDelta(a.week, owner, a.delta);
    }
    if (starters.length > 1) console.log(`        NOTE: ${starters.length} teams started him -- only one can be right, check by hand.`);
  }

  console.log("\n=== 2. Special-teams return touchdowns: who started the defense ===\n");
  for (const a of AFFECTED_DST) {
    const poolName = dstPoolName(a.nflTeam);
    if (!poolName) { console.log(`wk${String(a.week).padStart(2)}  ${a.nflTeam} D/ST  -> not in the 2026 draft pool?`); continue; }
    const starters = startersFor(a.week, poolName);
    const label = `${poolName} (${a.nflTeam})`;
    if (starters.length === 0) {
      console.log(`wk${String(a.week).padStart(2)}  ${label.padEnd(26)} +${a.delta}  -> not started by anyone`);
      console.log(`        ${a.play}`);
      continue;
    }
    for (const s of starters) {
      const owner = ownerById.get(String(s.team_id)) ?? `team ${s.team_id}`;
      console.log(`wk${String(a.week).padStart(2)}  ${label.padEnd(26)} +${a.delta}  -> ${owner}`);
      console.log(`        ${a.play}`);
      addDelta(a.week, owner, a.delta);
    }
  }

  console.log("\n=== 3. Is the affected kicker still rostered? ===\n");
  console.log("buildEffectiveStarters resolves each saved starter against the team's CURRENT");
  console.log("roster and backfills any slot it cannot fill, so re-running");
  console.log("finalizeWeeklyResultsFromTank on an old week does NOT replay that week -- it");
  console.log("scores that week's saved lineups against today's rosters.\n");
  const { data: players, error: playersError } = await supabaseAdmin.from("players").select("name, team_id");
  if (playersError) throw new Error(`Unable to load players: ${playersError.message}`);
  const holderByName = new Map<string, string | null>();
  for (const p of players ?? []) holderByName.set(normalizePlayerName(String(p.name ?? "")), p.team_id ? String(p.team_id) : null);
  for (const a of AFFECTED_KICKERS) {
    const holder = holderByName.get(normalizePlayerName(a.kicker));
    const where = holder === undefined ? "not in the players table at all"
      : holder === null ? "on no roster (free agent)"
      : `rostered by ${ownerById.get(holder) ?? holder}`;
    console.log(`wk${String(a.week).padStart(2)}  ${a.kicker.padEnd(18)} is now ${where}`);
  }
  console.log("\nAny line that is not 'rostered by <the owner who started him>' means a");
  console.log("re-finalize of that week would NOT restore his points -- it would score a");
  console.log("different player. Correct those weeks by updating the stored score instead.");

  console.log("\n=== 4. Effect on finalized results ===\n");
  for (const week of weeks) {
    const { data: results, error } = await supabaseAdmin.from("weekly_results")
      .select("week, home_owner, away_owner, home_score, away_score, is_final, league_median")
      .eq("season", SEASON).eq("week", week).order("id");
    if (error) throw new Error(`Unable to load week ${week} results: ${error.message}`);
    const rows = results ?? [];
    if (rows.length === 0) { console.log(`Week ${week}: no weekly_results rows.\n`); continue; }
    if (!rows.every(r => r.is_final)) {
      console.log(`Week ${week}: NOT finalized yet. The duplicate-FG fix is already deployed, so`);
      console.log(`  its kicker scores will be right the first time. The return touchdown will`);
      console.log(`  still be missing unless issue 2 is fixed before this week finalizes.\n`);
      continue;
    }

    const before = new Map<string, number>();
    for (const r of rows) {
      before.set(String(r.home_owner), Number(r.home_score ?? 0));
      before.set(String(r.away_owner), Number(r.away_score ?? 0));
    }
    const after = new Map(before);
    let touched = false;
    for (const [key, delta] of deltasByWeekOwner) {
      const [w, owner] = key.split("|");
      if (Number(w) !== week) continue;
      if (!after.has(owner)) { console.log(`Week ${week}: ${owner} has no weekly_results row?`); continue; }
      after.set(owner, r1(after.get(owner)! + delta));
      touched = true;
    }
    if (!touched) { console.log(`Week ${week}: no finalized team score is affected.\n`); continue; }

    const medBefore = median([...before.values()]);
    const medAfter = median([...after.values()]);
    console.log(`Week ${week}: league median ${medBefore} -> ${medAfter}${medBefore === medAfter ? " (unchanged)" : "  *** MOVED ***"}`);

    let anyFlip = false;
    for (const r of rows) {
      const h = String(r.home_owner), a = String(r.away_owner);
      const winner = (m: Map<string, number>) => {
        const hs = m.get(h)!, as = m.get(a)!;
        return hs > as ? h : as > hs ? a : "tie";
      };
      const wB = winner(before), wA = winner(after);
      if (wB !== wA) {
        anyFlip = true;
        console.log(`  *** H2H FLIP: ${h} ${before.get(h)} - ${before.get(a)} ${a}  =>  ${after.get(h)} - ${after.get(a)}  (winner ${wB} -> ${wA})`);
      }
    }
    for (const owner of before.keys()) {
      const bB = before.get(owner)! > medBefore, bA = after.get(owner)! > medAfter;
      if (bB !== bA) {
        anyFlip = true;
        console.log(`  *** MEDIAN FLIP: ${owner} ${before.get(owner)} vs ${medBefore} (${bB ? "win" : "loss"})  =>  ${after.get(owner)} vs ${medAfter} (${bA ? "win" : "loss"})`);
      }
    }
    for (const owner of before.keys()) {
      if (before.get(owner) !== after.get(owner)) console.log(`  points-for: ${owner} ${before.get(owner)} -> ${after.get(owner)}`);
    }
    if (!anyFlip) console.log("  no head-to-head or median result changes this week.");

    // A rivalry game pays $30 to the winner and is then marked resolved, and
    // finalization skips a resolved row -- so if a flip lands on one, re-running
    // anything will NOT move the money. It has to be corrected by hand.
    const { data: rivalry, error: rivalryError } = await supabaseAdmin.from("rivalry_games")
      .select("team_id, opponent_team_id, resolved").eq("season", SEASON).eq("week", week);
    if (rivalryError) throw new Error(`Unable to load week ${week} rivalry games: ${rivalryError.message}`);
    for (const rg of rivalry ?? []) {
      const a1 = ownerById.get(String(rg.team_id)) ?? String(rg.team_id);
      const a2 = ownerById.get(String(rg.opponent_team_id)) ?? String(rg.opponent_team_id);
      console.log(`  rivalry game declared: ${a1} vs ${a2}${rg.resolved ? " (already resolved and paid)" : " (not yet resolved)"}`);
    }
    console.log("");
  }

  console.log("Done. Nothing was written.");
  console.log("");
  console.log("If a week needs correcting, prefer updating that week's weekly_results");
  console.log("scores directly and then re-running the standings recompute:");
  console.log("  curl -H \"Authorization: Bearer $CRON_SECRET\" https://wrcfantasyfootball.com/api/scheduled/standings-recompute");
  console.log("That rebuilds every record and median from the stored scores without");
  console.log("re-deriving any lineup, so it cannot be thrown off by roster drift.");
}

main().catch(err => { console.error(err); process.exit(1); });
