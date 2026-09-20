import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { resolveFaabWinner, type FaabBidCandidate, type TeamStandingForTiebreak } from "./faabResolution";
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
    .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name")
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

  // Group by the normalized name so two bids on the same person under
  // slightly different spellings still compete with each other.
  const byPlayer = new Map<string, typeof pendingBids>();
  for (const bid of pendingBids) {
    const key = normalizePlayerName(bid.player_name);
    const list = byPlayer.get(key) ?? [];
    list.push(bid);
    byPlayer.set(key, list);
  }

  // One snapshot of the players table for the whole run: used to add the
  // won player (creating the row when they've never been rostered), to
  // verify a pledged drop player is still on the bidder's roster, and to
  // keep per-team roster counts current as awards land.
  const playerRows = await loadPlayerRows();
  const rosterCount = new Map<string, number>();
  for (const row of playerRows) {
    if (row.team_id) rosterCount.set(row.team_id, (rosterCount.get(row.team_id) ?? 0) + 1);
  }

  const resolvedAt = new Date().toISOString();
  const awarded: AwardResult[] = [];
  // Bids that were neither awarded nor a normal "outbid" loss: the won
  // player turned out to already be rostered, or a write failed partway.
  // Surfaced in the response so the commissioner can see what got skipped.
  const failed: { playerName: string; reason: string }[] = [];

  for (const [, bids] of Array.from(byPlayer.entries())) {
    const playerName = bids[0].player_name;

    // Each player's award is isolated. Before this, one bid that threw
    // (typically a bid on a player already on another roster, which makes
    // rosterPlayerForTeam throw) aborted the entire loop and every
    // remaining team's legitimate awards went unprocessed -- Sun 9/20,
    // 2026: Bill's stale $225 Deebo Samuel bid took down five other bids.
    try {
      // A player already sitting on any roster is not a free agent, so no
      // bid on them can be awarded -- this was the exact crash. Void the
      // whole group and move on. The bid-time guard now catches most of
      // these at submission; this stays as the backstop because it uses
      // the same normalizer the roster placement does.
      const wonRow = findPlayerRowByName(playerRows, playerName);
      if (wonRow && wonRow.team_id) {
        const { error } = await supabaseAdmin.from("faab_bids")
          .update({ status: "cancelled", resolved_at: resolvedAt })
          .in("id", bids.map(b => b.id));
        if (error) throw new Error(`Unable to void bids on already-rostered ${playerName}`);
        failed.push({ playerName, reason: "already on a WRC roster" });
        continue;
      }

      // A bid is only awardable if the roster move it describes can still
      // happen: either its pledged drop player is still on the bidder's
      // roster, or the bidder has an open spot. A drop player who has
      // already been cut (typically by this same run awarding that team's
      // other bid that pledged the same player) can't be dropped twice, and
      // silently adding without a drop would push the roster past 18.
      // Such bids are voided rather than awarded; the next-best bid wins.
      const awardable: typeof bids = [];
      const voidedIds: string[] = [];
      for (const bid of bids) {
        const dropRow = bid.drop_player_id ? playerRows.find(r => r.id === bid.drop_player_id) : null;
        const dropStillOnTeam = Boolean(dropRow && dropRow.team_id === bid.team_id);
        const hasOpenSpot = (rosterCount.get(bid.team_id) ?? 0) < ROSTER_LIMIT;
        if (dropStillOnTeam || hasOpenSpot) awardable.push(bid);
        else voidedIds.push(bid.id);
      }
      if (voidedIds.length) {
        const { error } = await supabaseAdmin.from("faab_bids").update({ status: "cancelled", resolved_at: resolvedAt }).in("id", voidedIds);
        if (error) throw new Error(`Unable to void unfillable FAAB bids for ${playerName}`);
      }
      if (!awardable.length) continue;

      const candidates: FaabBidCandidate[] = awardable.map(b => ({ id: b.id, teamId: b.team_id, bidAmount: Number(b.bid_amount ?? 0) }));
      const winnerCandidate = resolveFaabWinner(candidates, standingsByTeamId);
      const winningBid = awardable.find(b => b.id === winnerCandidate.id)!;
      const losingBidIds = awardable.filter(b => b.id !== winningBid.id).map(b => b.id);

      // Place the won player FIRST. This is the only step that can fail for
      // a data reason (row already claimed in a race), and doing it before
      // any bid-status or FAAB write means such a failure leaves nothing
      // half-done: the catch below simply voids the still-pending bids.
      await rosterPlayerForTeam(playerRows, winningBid.team_id, {
        name: winningBid.player_name,
        position: winningBid.player_pos,
        nflTeam: winningBid.player_nfl_team,
      });
      rosterCount.set(winningBid.team_id, (rosterCount.get(winningBid.team_id) ?? 0) + 1);

      const [{ error: winError }, { error: loseError }, { data: winningTeam, error: teamError }] = await Promise.all([
        supabaseAdmin.from("faab_bids").update({ status: "won", resolved_at: resolvedAt }).eq("id", winningBid.id),
        losingBidIds.length
          ? supabaseAdmin.from("faab_bids").update({ status: "lost", resolved_at: resolvedAt }).in("id", losingBidIds)
          : Promise.resolve({ error: null }),
        supabaseAdmin.from("teams").select("faab").eq("id", winningBid.team_id).single(),
      ]);
      if (winError || loseError || teamError || !winningTeam) throw new Error(`Unable to resolve FAAB bids for ${playerName}`);

      const remainingFaab = Math.max(0, Number(winningTeam.faab ?? 0) - Number(winningBid.bid_amount));
      const { error: faabError } = await supabaseAdmin.from("teams").update({ faab: remainingFaab }).eq("id", winningBid.team_id);
      if (faabError) throw new Error(`Unable to deduct winning FAAB bid for ${playerName}`);

      // Only drop if the pledged player is actually still here. (If the
      // bidder had an open spot and their drop player was already gone,
      // the bid was still awardable above, but there's nothing to drop and
      // no DROP history line should be written.)
      const dropRow = winningBid.drop_player_id ? playerRows.find(r => r.id === winningBid.drop_player_id) : null;
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

      awarded.push({ playerName, winningTeamName: winningBid.team_name, bidAmount: winningBid.bid_amount, bidCount: bids.length });
    } catch (err) {
      // Isolate the failure: record why, void any of this player's bids
      // that are still pending so the run doesn't leave them dangling, and
      // keep going with the rest of the batch instead of aborting it. A
      // bid already marked won/lost above is left as-is for the
      // commissioner to review (it shows up in `failed`).
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ playerName, reason });
      await supabaseAdmin.from("faab_bids")
        .update({ status: "cancelled", resolved_at: resolvedAt })
        .in("id", bids.map(b => b.id))
        .eq("status", "pending");
    }
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
