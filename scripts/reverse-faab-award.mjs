/**
 * WRC Fantasy Football — reverse a single automated FAAB award.
 *
 * One-off commissioner correction for the Sep 17, 2026 automated award:
 *   ADD   HamSandwich — Malachi Fields      "FAAB $1 — automated award"
 *   DROP  HamSandwich — De'Zhaun Stribling  "Dropped to make room for Malachi Fields"
 *
 * Undoes every write processAllPendingFaabBids() made for that bid
 * (server/scheduledFaabAward.ts), in reverse:
 *   1. players  — Malachi Fields back to the free agent pool (team_id null)
 *   2. players  — De'Zhaun Stribling back on the roster (dropped_at cleared)
 *   3. teams    — refund the winning bid amount to the team's FAAB balance
 *   4. roster_moves — delete the ADD and DROP history rows
 *   5. faab_bids    — mark the winning bid per --bid (default: cancelled)
 *
 * Dry run by default: prints current state and every planned write, and
 * touches nothing. Re-run with --apply to actually write.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/reverse-faab-award.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/reverse-faab-award.mjs --apply
 *
 * Options:
 *   --bid=cancel   (default) winning bid -> status "cancelled". Keeps the bid
 *                  in history and, because the cron only ever processes
 *                  "pending" bids, guarantees it is never re-awarded.
 *   --bid=pending  winning bid -> status "pending". WARNING: the next Thu/Sun
 *                  9am ET cron run WILL award this player again.
 *   --bid=keep     leave the winning bid row as "won" (history untouched).
 *   --losing=keep     (default) leave other teams' losing bids on this player
 *                     as "lost".
 *   --losing=pending  restore other teams' losing bids to "pending" so they
 *                     compete for the player again on the next award run.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

// ---- the transaction being reversed -------------------------------------
const TEAM_NAME = "HamSandwich";
const ADD_PLAYER_NAME = "Malachi Fields";
const DROP_PLAYER_NAME = "De'Zhaun Stribling";
const ADD_MOVE_NOTE = "FAAB $1 — automated award";
const DROP_MOVE_NOTE = `Dropped to make room for ${ADD_PLAYER_NAME}`;
const EXPECTED_BID_AMOUNT = 1;
// -------------------------------------------------------------------------

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Re-run with the service role key in the environment.");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const BID_MODE = (args.find(a => a.startsWith("--bid="))?.split("=")[1] ?? "cancel");
const LOSING_MODE = (args.find(a => a.startsWith("--losing="))?.split("=")[1] ?? "keep");
if (!["cancel", "pending", "keep"].includes(BID_MODE)) {
  console.error(`Invalid --bid=${BID_MODE}. Use cancel, pending, or keep.`);
  process.exit(1);
}
if (!["keep", "pending"].includes(LOSING_MODE)) {
  console.error(`Invalid --losing=${LOSING_MODE}. Use keep or pending.`);
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (msg) => { console.error(`\nABORTED: ${msg}`); process.exit(1); };
const h = (title) => console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);

// ---- 1. read current state ----------------------------------------------
h(`REVERSE FAAB AWARD — ${APPLY ? "APPLY (writes will be made)" : "DRY RUN (no writes)"}`);
console.log(`Team:        ${TEAM_NAME}`);
console.log(`Un-add:      ${ADD_PLAYER_NAME}`);
console.log(`Un-drop:     ${DROP_PLAYER_NAME}`);
console.log(`Bid row:     --bid=${BID_MODE}`);
console.log(`Losing bids: --losing=${LOSING_MODE}`);

const { data: allTeams, error: teamsError } = await sb.from("teams").select("*");
if (teamsError) fail(`Unable to load teams: ${teamsError.message}`);
// teams rows are referred to by `name` in some procedures and `team_name` in
// others, so match on either (plus owner) rather than assuming one column.
const team = (allTeams ?? []).find(t =>
  [t.name, t.team_name, t.owner].some(v => typeof v === "string" && v.trim().toLowerCase() === TEAM_NAME.toLowerCase()));
if (!team) fail(`No team matching "${TEAM_NAME}" in the teams table.`);

const [{ data: addPlayerRows, error: addPlayerError }, { data: dropPlayerRows, error: dropPlayerError }] = await Promise.all([
  sb.from("players").select("*").ilike("name", ADD_PLAYER_NAME),
  sb.from("players").select("*").ilike("name", DROP_PLAYER_NAME),
]);
if (addPlayerError) fail(`Unable to load ${ADD_PLAYER_NAME}: ${addPlayerError.message}`);
if (dropPlayerError) fail(`Unable to load ${DROP_PLAYER_NAME}: ${dropPlayerError.message}`);
if ((addPlayerRows ?? []).length > 1) fail(`${ADD_PLAYER_NAME} matches ${addPlayerRows.length} players rows — resolve by hand.`);
if ((dropPlayerRows ?? []).length > 1) fail(`${DROP_PLAYER_NAME} matches ${dropPlayerRows.length} players rows — resolve by hand.`);
const addPlayer = addPlayerRows?.[0] ?? null;
const dropPlayer = dropPlayerRows?.[0] ?? null;

const { data: moves, error: movesError } = await sb.from("roster_moves").select("*")
  .in("player_name", [ADD_PLAYER_NAME, DROP_PLAYER_NAME])
  .order("created_at", { ascending: false });
if (movesError) fail(`Unable to load roster_moves: ${movesError.message}`);
const teamMatchesMove = (m) => [m.team_name, m.owner].some(v => typeof v === "string" && v.trim().toLowerCase() === TEAM_NAME.toLowerCase());
const addMove = (moves ?? []).find(m => m.move_type === "ADD" && m.player_name === ADD_PLAYER_NAME && teamMatchesMove(m) && m.note === ADD_MOVE_NOTE)
  ?? (moves ?? []).find(m => m.move_type === "ADD" && m.player_name === ADD_PLAYER_NAME && teamMatchesMove(m));
const dropMove = (moves ?? []).find(m => m.move_type === "DROP" && m.player_name === DROP_PLAYER_NAME && teamMatchesMove(m) && m.note === DROP_MOVE_NOTE)
  ?? (moves ?? []).find(m => m.move_type === "DROP" && m.player_name === DROP_PLAYER_NAME && teamMatchesMove(m));

const { data: bids, error: bidsError } = await sb.from("faab_bids").select("*").ilike("player_name", ADD_PLAYER_NAME);
if (bidsError) fail(`Unable to load faab_bids: ${bidsError.message}`);
const winningBid = (bids ?? []).find(b => b.status === "won" && b.team_id === team.id);
const losingBids = (bids ?? []).filter(b => b.status === "lost");

const { data: lineupRows, error: lineupError } = await sb.from("lineups").select("*").ilike("player_name", ADD_PLAYER_NAME);
if (lineupError) fail(`Unable to load lineups: ${lineupError.message}`);

h("CURRENT STATE");
console.log(`team:    id=${team.id}  name=${team.name ?? team.team_name}  owner=${team.owner}  faab=$${team.faab}`);
console.log(`players/${ADD_PLAYER_NAME}:`, addPlayer
  ? `id=${addPlayer.id} team_id=${addPlayer.team_id} acquisition=${addPlayer.acquisition} draft_round=${addPlayer.draft_round ?? "null"} dropped_at=${addPlayer.dropped_at ?? "null"}`
  : "NO ROW (the award's add matched no players row)");
console.log(`players/${DROP_PLAYER_NAME}:`, dropPlayer
  ? `id=${dropPlayer.id} team_id=${dropPlayer.team_id} acquisition=${dropPlayer.acquisition} draft_round=${dropPlayer.draft_round ?? "null"} dropped_at=${dropPlayer.dropped_at ?? "null"}`
  : "NO ROW");
console.log(`roster_moves ADD:`, addMove ? `id=${addMove.id} faab_spent=${addMove.faab_spent} created_at=${addMove.created_at} note=${JSON.stringify(addMove.note)}` : "NOT FOUND");
console.log(`roster_moves DROP:`, dropMove ? `id=${dropMove.id} created_at=${dropMove.created_at} note=${JSON.stringify(dropMove.note)}` : "NOT FOUND");
console.log(`faab_bids winning:`, winningBid ? `id=${winningBid.id} bid=$${winningBid.bid_amount} week=${winningBid.week} drop_player=${winningBid.drop_player_name} resolved_at=${winningBid.resolved_at}` : "NOT FOUND");
console.log(`faab_bids losing on ${ADD_PLAYER_NAME}: ${losingBids.length}`);
for (const b of losingBids) console.log(`   - id=${b.id} team=${b.team_name} bid=$${b.bid_amount}`);
console.log(`lineups referencing ${ADD_PLAYER_NAME}: ${(lineupRows ?? []).length}`);
for (const l of lineupRows ?? []) console.log(`   - team_id=${l.team_id} week=${l.week} season=${l.season} slot=${l.slot} bench=${l.is_bench}`);

// ---- 2. safety checks ----------------------------------------------------
h("PRE-FLIGHT CHECKS");
const problems = [];
if (!addPlayer) problems.push(`No players row for ${ADD_PLAYER_NAME} — nothing to return to the free agent pool.`);
else if (addPlayer.team_id !== team.id) problems.push(`${ADD_PLAYER_NAME} is not on ${TEAM_NAME}'s roster (team_id=${addPlayer.team_id}). Already reversed, or the award never landed.`);
if (!dropPlayer) problems.push(`No players row for ${DROP_PLAYER_NAME} — cannot restore him to the roster.`);
else if (dropPlayer.team_id !== null) problems.push(`${DROP_PLAYER_NAME} already has team_id=${dropPlayer.team_id} — not in the dropped state this script expects.`);
if (!addMove) problems.push("The ADD roster_moves row was not found.");
if (!dropMove) problems.push("The DROP roster_moves row was not found.");
if (!winningBid) problems.push(`No "won" faab_bids row for ${ADD_PLAYER_NAME} on ${TEAM_NAME}.`);
else if (Number(winningBid.bid_amount) !== EXPECTED_BID_AMOUNT) problems.push(`Winning bid is $${winningBid.bid_amount}, expected $${EXPECTED_BID_AMOUNT}.`);

if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  fail(`${problems.length} check(s) failed — refusing to write a partial reversal. Re-read the state above.`);
}
console.log("  ✓ all rows found in the expected post-award state");

const refund = Number(winningBid.bid_amount);
const newFaab = Number(team.faab ?? 0) + refund;
// The FAAB drop path sets acquisition "FA" but leaves draft_round intact, so
// a drafted player's original "Rd N" acquisition is recoverable from it.
const restoredAcquisition = dropPlayer.draft_round ? `Rd ${dropPlayer.draft_round}` : "FA";

h("PLANNED WRITES");
console.log(`1. players[${addPlayer.id}]  ${ADD_PLAYER_NAME}: team_id ${addPlayer.team_id} -> null, acquisition -> "FA"`);
console.log(`   (dropped_at left as ${addPlayer.dropped_at ?? "null"} — this is a reversal, not a cut, so no 48h re-add lock)`);
console.log(`2. players[${dropPlayer.id}]  ${DROP_PLAYER_NAME}: team_id null -> ${team.id}, acquisition "${dropPlayer.acquisition}" -> "${restoredAcquisition}", dropped_at ${dropPlayer.dropped_at ?? "null"} -> null`);
console.log(`3. teams[${team.id}]  faab $${team.faab} -> $${newFaab} (refund $${refund})`);
console.log(`4. roster_moves: DELETE id=${addMove.id} (ADD) and id=${dropMove.id} (DROP)`);
console.log(`5. faab_bids[${winningBid.id}]: status "won" -> ${BID_MODE === "keep" ? '"won" (unchanged)' : `"${BID_MODE === "cancel" ? "cancelled" : "pending"}"`}`);
if (LOSING_MODE === "pending" && losingBids.length) console.log(`6. faab_bids: ${losingBids.length} losing bid(s) -> "pending"`);
if (BID_MODE === "pending") console.log(`\n   !! --bid=pending means the next Thu/Sun 9am ET cron will award ${ADD_PLAYER_NAME} again.`);
if ((lineupRows ?? []).length) console.log(`\n   !! ${ADD_PLAYER_NAME} appears in ${lineupRows.length} lineup row(s) above. Those are NOT touched by this script — fix the affected lineup(s) after reversing.`);

if (!APPLY) {
  h("DRY RUN COMPLETE — nothing was written. Re-run with --apply to execute.");
  process.exit(0);
}

// ---- 3. apply ------------------------------------------------------------
const backupPath = `faab-reversal-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(backupPath, JSON.stringify({
  capturedAt: new Date().toISOString(),
  team, addPlayer, dropPlayer, addMove, dropMove, winningBid, losingBids, lineupRows,
}, null, 2));
console.log(`\nPre-change snapshot written to ${backupPath}`);

h("APPLYING");
const step = async (label, promise) => {
  const { error } = await promise;
  if (error) fail(`${label} failed: ${error.message} — state is now PARTIALLY reversed. Use the snapshot above to finish by hand.`);
  console.log(`  ✓ ${label}`);
};

await step(`${ADD_PLAYER_NAME} -> free agent pool`,
  sb.from("players").update({ team_id: null, acquisition: "FA" }).eq("id", addPlayer.id).eq("team_id", team.id));
await step(`${DROP_PLAYER_NAME} -> back on ${TEAM_NAME}`,
  sb.from("players").update({ team_id: team.id, acquisition: restoredAcquisition, dropped_at: null }).eq("id", dropPlayer.id));
await step(`refund $${refund} FAAB (-> $${newFaab})`,
  sb.from("teams").update({ faab: newFaab }).eq("id", team.id));
await step("delete ADD/DROP roster_moves rows",
  sb.from("roster_moves").delete().in("id", [addMove.id, dropMove.id]));
if (BID_MODE !== "keep") {
  const status = BID_MODE === "cancel" ? "cancelled" : "pending";
  await step(`winning bid -> "${status}"`,
    sb.from("faab_bids").update({ status, resolved_at: BID_MODE === "pending" ? null : new Date().toISOString() }).eq("id", winningBid.id));
}
if (LOSING_MODE === "pending" && losingBids.length) {
  await step(`${losingBids.length} losing bid(s) -> "pending"`,
    sb.from("faab_bids").update({ status: "pending", resolved_at: null }).in("id", losingBids.map(b => b.id)));
}

// ---- 4. verify -----------------------------------------------------------
h("VERIFYING");
const [{ data: vAdd }, { data: vDrop }, { data: vTeam }, { data: vMoves }, { data: vBid }] = await Promise.all([
  sb.from("players").select("*").eq("id", addPlayer.id).maybeSingle(),
  sb.from("players").select("*").eq("id", dropPlayer.id).maybeSingle(),
  sb.from("teams").select("*").eq("id", team.id).maybeSingle(),
  sb.from("roster_moves").select("id").in("id", [addMove.id, dropMove.id]),
  sb.from("faab_bids").select("*").eq("id", winningBid.id).maybeSingle(),
]);
const checks = [
  [`${ADD_PLAYER_NAME} unrostered`, vAdd?.team_id === null],
  [`${DROP_PLAYER_NAME} on ${TEAM_NAME}`, vDrop?.team_id === team.id],
  [`${DROP_PLAYER_NAME} dropped_at cleared`, !vDrop?.dropped_at],
  [`FAAB is $${newFaab}`, Number(vTeam?.faab) === newFaab],
  ["both roster_moves rows deleted", (vMoves ?? []).length === 0],
  [`winning bid status`, BID_MODE === "keep" ? vBid?.status === "won" : vBid?.status === (BID_MODE === "cancel" ? "cancelled" : "pending")],
];
let allOk = true;
for (const [label, ok] of checks) { console.log(`  ${ok ? "✓" : "✗"} ${label}`); if (!ok) allOk = false; }
h(allOk ? "REVERSAL COMPLETE — all checks passed." : "REVERSAL INCOMPLETE — see failed checks above and the snapshot file.");
process.exit(allOk ? 0 : 1);
