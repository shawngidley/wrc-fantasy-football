import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { type TeamStandingForTiebreak } from "./faabResolution";
import { planFaabAwards, type PlannerBid } from "./faabAwardPlan";
import { findPlayerRowByName, loadPlayerRows, rosterPlayerForTeam } from "./rosterPlayerForTeam";
import { normalizePlayerName } from "../shared/playerNameMatch";

const ROSTER_LIMIT = 18;

// First automated award run: Sunday, September 13, 2026 at 9am ET.
// Before this date, this endpoint deliberately does nothing -- the
// commissioner's manual "Manage Bids" award action remains the only way
// to process bids until then.
const AUTOMATION_START = new Date("2026-09-13T09:00:00-04:00");

/**
 * Vercel cron schedules are fixed UTC times and don't shift for DST, but
 * "9am ET" does (EDT is UTC-4 through early November, EST is UTC-5 after).
 * Rather than hardcoding one UTC time that would silently drift an hour
 * off once DST ends mid-season, the cron (see vercel.json) fires at both
 * possible UTC times for 9am ET on Thu/Sun, and this check is what
 * actually decides whether to process -- only true right around 9am ET
 * on the correct two days, regardless of which of the two UTC triggers
 * fired.
 */
export function isFaabAwardWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? -1);
  return (weekday === "Sun" || weekday === "Thu") && hour === 9;
}

interface AwardResult {
  playerName: string;
  winningTeamName: string;
  bidAmount: number;
  bidCount: number;
}

export async function processAllPendingFaabBids(): Promise<{ awarded: AwardResult[]; failed: { playerName: string; reason: string }[]; skippedNoPending: boolean }> {
  const { data: pendingBids, error: bidsError } = await supabaseAdmin
    .from("faab_bids")
    .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name, group_id, group_rank, group_max_wins")
    .eq("status", "pending");
  if (bidsError) throw new Error("Unable to load pending FAAB bids");
  if (!pendingBids || pendingBids.length === 0) return { awarded: [], failed: [], skippedNoPending: true };

  const { data: standings, error: standingsError } = await supabaseAdmin
    .from("teams")
    .select("id, wins, losses, ties, points_for");
  if (standingsError || !standings) throw new Error("Unable to load team standings for FAAB tiebreak");
  const standingsByTeamId = new Map<string, TeamStandingForTiebreak>(
    standings.map(team => [team.id, {
      wins: Number(team.wins ?? 0),
      losses: Number(team.losses ?? 0),
      ties: Number(team.ties ?? 0),
      pointsFor: Number(team.points_for ?? 0),
    }]),
  );

  // One snapshot of the players table for the whole run: used to add the
  // won player (creating the row when they've never been rostered), to
  // verify a pledged drop player is still on the bidder's roster, and to
  // keep per-team roster counts current as awards land.
  const playerRows = await loadPlayerRows();
  const rosterCount = new Map<string, number>();
  for (const row of playerRows) {
    if (row.team_id) rosterCount.set(row.team_id, (rosterCount.get(row.team_id) ?? 0) + 1);
  }

  // Number of pending bids on each player, for the award summary's bidCount.
  const bidCountByKey = new Map<string, number>();
  for (const bid of pendingBids) {
    const key = normalizePlayerName(bid.player_name);
    bidCountByKey.set(key, (bidCountByKey.get(key) ?? 0) + 1);
  }

  // Decide the whole run up front with the pure planner: who wins, who's
  // outbid (lost), who a conditional group passed over (skipped), and who
  // can't be awarded at all (cancelled: already rostered, or no spot to
  // fill). This is where the ranked-group, win-one/up-to-N logic lives, and
  // it is exhaustively unit tested. The writes below just execute the plan.
  const plannerBids: PlannerBid[] = pendingBids.map(bid => {
    const wonRow = findPlayerRowByName(playerRows, bid.player_name);
    const dropRow = bid.drop_player_id ? playerRows.find(r => r.id === bid.drop_player_id) : null;
    return {
      id: bid.id,
      teamId: bid.team_id,
      playerKey: normalizePlayerName(bid.player_name),
      bidAmount: Number(bid.bid_amount ?? 0),
      groupId: bid.group_id ?? null,
      groupRank: bid.group_rank ?? null,
      groupMaxWins: bid.group_max_wins ?? null,
      playerAlreadyRostered: Boolean(wonRow && wonRow.team_id),
      dropStillOnTeam: Boolean(dropRow && dropRow.team_id === bid.team_id),
    };
  });
  const plan = planFaabAwards(
    plannerBids,
    standingsByTeamId,
    teamId => (rosterCount.get(teamId) ?? 0) < ROSTER_LIMIT,
  );

  const bidById = new Map(pendingBids.map(b => [b.id, b]));
  const resolvedAt = new Date().toISOString();
  const awarded: AwardResult[] = [];
  // Bids that were neither awarded nor a normal outcome (lost/skipped): the
  // won player was already rostered, there was no spot, or a write failed
  // partway. Surfaced so the commissioner can see what didn't go through.
  const failed: { playerName: string; reason: string }[] = [];

  // Passed-over group picks are a final decision from the plan; mark them now.
  if (plan.skipped.length) {
    const { error } = await supabaseAdmin.from("faab_bids").update({ status: "skipped", resolved_at: resolvedAt }).in("id", plan.skipped);
    if (error) throw new Error("Unable to mark passed-over FAAB bids as skipped");
  }
  // Unawardable bids (already-rostered / no roster spot): void and surface.
  if (plan.cancelled.length) {
    const { error } = await supabaseAdmin.from("faab_bids").update({ status: "cancelled", resolved_at: resolvedAt }).in("id", plan.cancelled.map(c => c.id));
    if (error) throw new Error("Unable to void unawardable FAAB bids");
    for (const c of plan.cancelled) {
      const b = bidById.get(c.id);
      failed.push({ playerName: b?.player_name ?? "Unknown", reason: c.reason === "already-rostered" ? "already on a WRC roster" : "no roster spot to fill the bid" });
    }
  }

  // Execute each winning bid. Sequential and isolated in its own try/catch --
  // one bid that throws (e.g. the won player got claimed in a race between
  // planning and this write) is voided and the rest of the batch still runs,
  // never aborting the whole loop (Sun 9/20, 2026: one stale bid took down
  // five others). A LIVE roster-spot recheck backstops the rare case of two
  // no-drop wins landing on one team the same run (only reachable via groups
  // or win-up-to-N); the planner's fillability used start-of-run counts.
  const failedPlayerKeys = new Set<string>();
  for (const winId of plan.award) {
    const winningBid = bidById.get(winId);
    if (!winningBid) continue;
    const playerName = winningBid.player_name;
    const playerKey = normalizePlayerName(playerName);
    try {
      const dropRow = winningBid.drop_player_id ? playerRows.find(r => r.id === winningBid.drop_player_id) : null;
      const dropStillOnTeam = Boolean(dropRow && dropRow.team_id === winningBid.team_id);
      const hasOpenSpot = (rosterCount.get(winningBid.team_id) ?? 0) < ROSTER_LIMIT;
      if (!dropStillOnTeam && !hasOpenSpot) {
        const { error } = await supabaseAdmin.from("faab_bids").update({ status: "cancelled", resolved_at: resolvedAt }).eq("id", winningBid.id).eq("status", "pending");
        if (error) throw new Error(`Unable to void unfillable winning bid for ${playerName}`);
        failed.push({ playerName, reason: "no roster spot left after other wins this run" });
        failedPlayerKeys.add(playerKey);
        continue;
      }

      // Place the won player FIRST. This is the only step that can fail for
      // a data reason (row already claimed in a race), and doing it before
      // any bid-status or FAAB write means such a failure leaves nothing
      // half-done: the catch below simply voids the still-pending bid.
      await rosterPlayerForTeam(playerRows, winningBid.team_id, {
        name: winningBid.player_name,
        position: winningBid.player_pos,
        nflTeam: winningBid.player_nfl_team,
      });
      rosterCount.set(winningBid.team_id, (rosterCount.get(winningBid.team_id) ?? 0) + 1);

      const [{ error: winError }, { data: winningTeam, error: teamError }] = await Promise.all([
        supabaseAdmin.from("faab_bids").update({ status: "won", resolved_at: resolvedAt }).eq("id", winningBid.id),
        supabaseAdmin.from("teams").select("faab").eq("id", winningBid.team_id).single(),
      ]);
      if (winError || teamError || !winningTeam) throw new Error(`Unable to resolve FAAB bid for ${playerName}`);

      const remainingFaab = Math.max(0, Number(winningTeam.faab ?? 0) - Number(winningBid.bid_amount));
      const { error: faabError } = await supabaseAdmin.from("teams").update({ faab: remainingFaab }).eq("id", winningBid.team_id);
      if (faabError) throw new Error(`Unable to deduct winning FAAB bid for ${playerName}`);

      // Only drop if the pledged player is actually still here.
      const dropping = Boolean(winningBid.drop_player_id && dropRow && dropRow.team_id === winningBid.team_id);
      if (dropping && dropRow) {
        const { error: dropError } = await supabaseAdmin.from("players")
          .update({ team_id: null, acquisition: "FA", dropped_at: new Date().toISOString() })
          .eq("id", winningBid.drop_player_id)
          .eq("team_id", winningBid.team_id);
        if (dropError) throw new Error(`Unable to drop the selected player for ${playerName}'s winning team`);
        dropRow.team_id = null;
        rosterCount.set(winningBid.team_id, (rosterCount.get(winningBid.team_id) ?? 1) - 1);
      }

      const moves = [{
        move_type: "ADD",
        team_name: winningBid.team_name,
        owner: winningBid.team_name,
        player_name: winningBid.player_name,
        player_pos: winningBid.player_pos,
        player_nfl_team: winningBid.player_nfl_team,
        faab_spent: winningBid.bid_amount,
        note: `FAAB $${winningBid.bid_amount} — automated award`,
      }];
      if (dropping && winningBid.drop_player_name) moves.push({
        move_type: "DROP",
        team_name: winningBid.team_name,
        owner: winningBid.team_name,
        player_name: winningBid.drop_player_name.trim(),
        player_pos: "—",
        player_nfl_team: "FA",
        faab_spent: null,
        note: `Dropped to make room for ${winningBid.player_name}`,
      });
      const { error: moveError } = await supabaseAdmin.from("roster_moves").insert(moves);
      if (moveError) throw new Error(`FAAB awarded for ${playerName}, but transaction history could not be written`);

      awarded.push({ playerName, winningTeamName: winningBid.team_name, bidAmount: winningBid.bid_amount, bidCount: bidCountByKey.get(playerKey) ?? 1 });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ playerName, reason });
      failedPlayerKeys.add(playerKey);
      await supabaseAdmin.from("faab_bids")
        .update({ status: "cancelled", resolved_at: resolvedAt })
        .eq("id", winningBid.id)
        .eq("status", "pending");
    }
  }

  // Mark the outbid bids lost -- except those on a player whose winning bid
  // failed above: if nobody actually got the player, its other bids are
  // voided (cancelled) rather than shown as lost, matching the old per-player
  // all-or-nothing behavior on a failed award.
  const lostIds: string[] = [];
  const voidedWithWinner: string[] = [];
  for (const id of plan.lost) {
    const bid = bidById.get(id);
    const key = bid ? normalizePlayerName(bid.player_name) : "";
    if (failedPlayerKeys.has(key)) voidedWithWinner.push(id);
    else lostIds.push(id);
  }
  if (lostIds.length) {
    const { error } = await supabaseAdmin.from("faab_bids").update({ status: "lost", resolved_at: resolvedAt }).in("id", lostIds);
    if (error) throw new Error("Unable to mark outbid FAAB bids as lost");
  }
  if (voidedWithWinner.length) {
    await supabaseAdmin.from("faab_bids").update({ status: "cancelled", resolved_at: resolvedAt }).in("id", voidedWithWinner).eq("status", "pending");
  }

  return { awarded, failed, skippedNoPending: false };
}

/**
 * Combined check: is right now actually a moment this cron should process
 * bids? True only on/after Sept 13, 2026 AND at 9am ET on a Thu or Sun --
 * covers both the Sunday-only start date and the fact that Thursday
 * awards (starting Sept 17, the very next Thu/Sun after Sept 13) fall out
 * of this same single guard automatically, with no separate Thursday-
 * specific date needed.
 */
export function shouldProcessFaabAwardNow(now = new Date()): boolean {
  if (now < AUTOMATION_START) return false;
  return isFaabAwardWindow(now);
}

export async function faabAwardSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    if (now < AUTOMATION_START) {
      res.json({ ok: true, skipped: "before-automation-start", automationStart: AUTOMATION_START.toISOString() });
      return;
    }
    if (!isFaabAwardWindow(now)) {
      res.json({ ok: true, skipped: "not-award-window" });
      return;
    }
    const result = await processAllPendingFaabBids();
    res.json({ ok: true, ...result, timestamp: now.toISOString() });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { finalization: "faab-award" },
    });
  }
}
