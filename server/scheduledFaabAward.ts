import type { Request, Response } from "express";
import { supabaseAdmin } from "./supabaseAdmin";
import { resolveFaabWinner, type FaabBidCandidate, type TeamStandingForTiebreak } from "./faabResolution";

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

export async function processAllPendingFaabBids(): Promise<{ awarded: AwardResult[]; skippedNoPending: boolean }> {
  const { data: pendingBids, error: bidsError } = await supabaseAdmin
    .from("faab_bids")
    .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name")
    .eq("status", "pending");
  if (bidsError) throw new Error("Unable to load pending FAAB bids");
  if (!pendingBids || pendingBids.length === 0) return { awarded: [], skippedNoPending: true };

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

  const byPlayer = new Map<string, typeof pendingBids>();
  for (const bid of pendingBids) {
    const list = byPlayer.get(bid.player_name) ?? [];
    list.push(bid);
    byPlayer.set(bid.player_name, list);
  }

  const resolvedAt = new Date().toISOString();
  const awarded: AwardResult[] = [];

  for (const [playerName, bids] of Array.from(byPlayer.entries())) {
    const candidates: FaabBidCandidate[] = bids.map(b => ({ id: b.id, teamId: b.team_id, bidAmount: Number(b.bid_amount ?? 0) }));
    const winnerCandidate = resolveFaabWinner(candidates, standingsByTeamId);
    const winningBid = bids.find(b => b.id === winnerCandidate.id)!;
    const losingBidIds = bids.filter(b => b.id !== winningBid.id).map(b => b.id);

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

    const { error: addError } = await supabaseAdmin.from("players")
      .update({ team_id: winningBid.team_id, acquisition: "FA" })
      .eq("name", winningBid.player_name);
    if (addError) throw new Error(`Unable to add ${playerName} to the winning roster`);

    if (winningBid.drop_player_id) {
      const { error: dropError } = await supabaseAdmin.from("players")
        .update({ team_id: null, acquisition: "FA" })
        .eq("id", winningBid.drop_player_id)
        .eq("team_id", winningBid.team_id);
      if (dropError) throw new Error(`Unable to drop the selected player for ${playerName}'s winning team`);
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
    if (winningBid.drop_player_name) moves.push({
      move_type: "DROP",
      team_name: winningBid.team_name,
      owner: winningBid.team_name,
      player_name: winningBid.drop_player_name,
      player_pos: "—",
      player_nfl_team: "FA",
      faab_spent: null,
      note: `Dropped to make room for ${winningBid.player_name}`,
    });
    const { error: moveError } = await supabaseAdmin.from("roster_moves").insert(moves);
    if (moveError) throw new Error(`FAAB awarded for ${playerName}, but transaction history could not be written`);

    awarded.push({ playerName, winningTeamName: winningBid.team_name, bidAmount: winningBid.bid_amount, bidCount: bids.length });
  }

  return { awarded, skippedNoPending: false };
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
