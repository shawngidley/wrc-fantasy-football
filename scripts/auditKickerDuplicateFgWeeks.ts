/**
 * READ-ONLY audit: who was affected by the duplicate-field-goal parser bug
 * fixed in 4da203f, and would any Week 1-10 result change?
 *
 * This script SELECTs only. It never updates weekly_results, team_standings,
 * earnings or anything else. Nothing it prints is applied anywhere -- decide
 * what to do with the output yourself.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/auditKickerDuplicateFgWeeks.ts
 *
 * AFFECTED below was produced by replaying every finalized 2026 regular-season
 * game through both the old parser (dedupe by play text) and the new one
 * (dedupe by ESPN play id) and keeping every kicker whose WRC field-goal
 * points differed. Only field goals matter: weeklyResultsFinalize always
 * passes Tank01 rawStats to calculateWrcKickerPoints, so extra-point scoring
 * comes from xpMade/xpAttempts and never from parsed play text.
 */
import { supabaseAdmin } from "../server/supabaseAdmin";
import { normalizePlayerName } from "../shared/playerNameMatch";

const SEASON = 2026;

type Affected = { week: number; game: string; kicker: string; nflTeam: string; old: number; now: number; delta: number };

const AFFECTED: Affected[] = [
  { week: 2, game: "CLE @ TB", kicker: "Chase McLaughlin", nflTeam: "TB", old: 13.5, now: 16.6, delta: 3.1 },
  { week: 2, game: "CLE @ TB", kicker: "Andre Szmyt", nflTeam: "CLE", old: 8.4, now: 11.8, delta: 3.4 },
  { week: 3, game: "TEN @ NYG", kicker: "Dominic Zvada", nflTeam: "NYG", old: 9.6, now: 13.5, delta: 3.9 },
  { week: 4, game: "NYJ @ CHI", kicker: "Cairo Santos", nflTeam: "CHI", old: 5.1, now: 8.1, delta: 3.0 },
  { week: 4, game: "KC @ LV", kicker: "Matt Gay", nflTeam: "LV", old: 16.5, now: 21.3, delta: 4.8 },
  { week: 5, game: "BAL @ ATL", kicker: "Tyler Loop", nflTeam: "BAL", old: 7.2, now: 12.3, delta: 5.1 },
  { week: 6, game: "NYJ @ NE", kicker: "Jason Sanders", nflTeam: "NYJ", old: 11.8, now: 15.4, delta: 3.6 },
  { week: 9, game: "DET @ MIA", kicker: "Zane Gonzalez", nflTeam: "MIA", old: 6.6, now: 10.0, delta: 3.4 },
  { week: 9, game: "NYG @ PHI", kicker: "Dominic Zvada", nflTeam: "NYG", old: 14.0, now: 18.9, delta: 4.9 },
  // Week 10 is NOT finalized yet (LAC @ BAL was still in progress), so these
  // two will be scored correctly the first time finalization runs. Listed for
  // completeness; the flip analysis below skips any week that is not final.
  { week: 10, game: "LAR @ ARI", kicker: "Chad Ryland", nflTeam: "ARI", old: 4.9, now: 9.8, delta: 4.9 },
  { week: 10, game: "SF @ DAL", kicker: "Brandon Aubrey", nflTeam: "DAL", old: 5.2, now: 10.4, delta: 5.2 },
];

const r1 = (v: number) => Math.round(v * 10) / 10;
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const { data: teams, error: teamsError } = await supabaseAdmin.from("teams").select("id, owner, name");
  if (teamsError || !teams) throw new Error(`Unable to load teams: ${teamsError?.message}`);
  const ownerById = new Map(teams.map(t => [String(t.id), String(t.owner)]));

  const weeks = Array.from(new Set(AFFECTED.map(a => a.week))).sort((a, b) => a - b);

  // ---- 1. Who started each affected kicker, from that week's saved lineups.
  // lineups is historical (keyed by week), so this is the week's real starter
  // even for a kicker who has since been dropped.
  const deltasByWeekOwner = new Map<string, number>();
  console.log("=== Who started each affected kicker ===\n");
  for (const week of weeks) {
    const { data: rows, error } = await supabaseAdmin.from("lineups")
      .select("team_id, slot, player_name, is_bench")
      .eq("season", SEASON).eq("week", week);
    if (error) throw new Error(`Unable to load week ${week} lineups: ${error.message}`);
    for (const a of AFFECTED.filter(x => x.week === week)) {
      const key = normalizePlayerName(a.kicker);
      const hits = (rows ?? []).filter(r => normalizePlayerName(String(r.player_name ?? "")) === key);
      const starters = hits.filter(r => !r.is_bench);
      if (starters.length === 0) {
        const benched = hits.length > 0 ? " (on a bench, not started)" : "";
        console.log(`wk${week}  ${a.kicker.padEnd(18)} ${String(a.delta.toFixed(1)).padStart(5)}  -> no saved starter row${benched}`);
        console.log(`        If no team saved a lineup that week the finalizer fills slots itself, so check`);
        console.log(`        buildEffectiveStarters for week ${week} before concluding nobody started him.`);
        continue;
      }
      for (const s of starters) {
        const owner = ownerById.get(String(s.team_id)) ?? `team ${s.team_id}`;
        console.log(`wk${week}  ${a.kicker.padEnd(18)} ${`+${a.delta.toFixed(1)}`.padStart(5)}  -> ${owner}  (${a.old} -> ${a.now})`);
        const k = `${week}|${owner}`;
        deltasByWeekOwner.set(k, r1((deltasByWeekOwner.get(k) ?? 0) + a.delta));
      }
      if (starters.length > 1) console.log(`        NOTE: ${starters.length} teams started him; only one can be right -- check manually.`);
    }
  }

  // ---- 2. Would any head-to-head or median result change?
  console.log("\n=== Effect on finalized results ===\n");
  for (const week of weeks) {
    const { data: results, error } = await supabaseAdmin.from("weekly_results")
      .select("week, home_owner, away_owner, home_score, away_score, is_final, league_median")
      .eq("season", SEASON).eq("week", week).order("id");
    if (error) throw new Error(`Unable to load week ${week} results: ${error.message}`);
    const rows = results ?? [];
    if (rows.length === 0) { console.log(`Week ${week}: no weekly_results rows.\n`); continue; }
    if (!rows.every(r => r.is_final)) { console.log(`Week ${week}: not finalized yet -- it will be scored with the fixed parser. Nothing to correct.\n`); continue; }

    const before = new Map<string, number>();
    for (const r of rows) {
      before.set(String(r.home_owner), Number(r.home_score ?? 0));
      before.set(String(r.away_owner), Number(r.away_score ?? 0));
    }
    const after = new Map(before);
    let touched = false;
    for (const [k, delta] of deltasByWeekOwner) {
      const [w, owner] = k.split("|");
      if (Number(w) !== week) continue;
      if (!after.has(owner)) { console.log(`Week ${week}: ${owner} has no weekly_results row?`); continue; }
      after.set(owner, r1(after.get(owner)! + delta));
      touched = true;
    }
    if (!touched) { console.log(`Week ${week}: no finalized team score is affected.\n`); continue; }

    const medBefore = median([...before.values()]);
    const medAfter = median([...after.values()]);
    console.log(`Week ${week}: league median ${medBefore} -> ${medAfter}${medBefore === medAfter ? " (unchanged)" : "  *** MOVED ***"}`);

    for (const r of rows) {
      const h = String(r.home_owner), a = String(r.away_owner);
      const res = (m: Map<string, number>) => {
        const hs = m.get(h)!, as = m.get(a)!;
        return hs > as ? h : as > hs ? a : "tie";
      };
      const wB = res(before), wA = res(after);
      if (wB !== wA) {
        console.log(`  *** H2H FLIP: ${h} ${before.get(h)} - ${before.get(a)} ${a}  =>  ${after.get(h)} - ${after.get(a)}  (winner ${wB} -> ${wA})`);
      }
    }
    for (const owner of before.keys()) {
      const bB = before.get(owner)! > medBefore, bA = after.get(owner)! > medAfter;
      if (bB !== bA) {
        console.log(`  *** MEDIAN FLIP: ${owner} ${before.get(owner)} vs ${medBefore} (${bB ? "win" : "loss"})  =>  ${after.get(owner)} vs ${medAfter} (${bA ? "win" : "loss"})`);
      }
    }
    console.log("");
  }
  console.log("Done. Nothing was written.");
}

main().catch(err => { console.error(err); process.exit(1); });
