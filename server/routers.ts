import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { commissionerProcedure, publicProcedure, router, teamProcedure } from "./_core/trpc";
import {
  getFantasyProsInjuries,
  getFantasyProsNews,
  getFantasyProsProjections,
  getFantasyProsRanks,
} from "./fantasypros";
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";
import { archiveFantasyProsNews, getArchivedFantasyProsNews, mergeFantasyProsNews } from "./fantasyprosArchive";
import { getPublicLeagueTeam, listPublicLeagueTeams, verifyLeagueTeamPin } from "./leagueAuth";
import { clearWrcTeamSession, readWrcTeamSession, writeWrcTeamSession } from "./wrcTeamSession";
import { supabaseAdmin } from "./supabaseAdmin";
import { validateProtectionSubmission } from "./protectionRules";
import { DRAFT_PICKS_2026 } from "../client/src/lib/draftData2026";

const normalizePlayerKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const WRC_DRAFT_TIMER_SECONDS = 90;
const WRC_DRAFT_TOTAL_ROUNDS = 18;
const WRC_DRAFT_TOTAL_TEAMS = 12;
const WRC_DRAFT_OWNER_TEAM_IDS: Record<string, string> = {
  "Jonas": "team-jonas", "David R.": "team-davidr", "Jason": "team-jason", "Keith": "team-keith",
  "Dan": "team-dan", "Scott N.": "team-scottn", "Bill": "team-bill", "Jamie": "team-jamie",
  "Scott M.": "team-scottm", "David S.": "team-davids", "Shawn": "team-shawn", "Greg": "team-greg",
};

function nextDraftState(currentRound: number, currentPick: number) {
  const nextPick = currentPick + 1 >= WRC_DRAFT_TOTAL_TEAMS ? 0 : currentPick + 1;
  const nextRound = currentPick + 1 >= WRC_DRAFT_TOTAL_TEAMS ? currentRound + 1 : currentRound;
  const complete = nextRound > WRC_DRAFT_TOTAL_ROUNDS;
  return {
    current_round: complete ? currentRound : nextRound,
    current_pick: complete ? currentPick : nextPick,
    complete,
    paused: false,
    timer_seconds: WRC_DRAFT_TIMER_SECONDS,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  league: router({
    teams: publicProcedure.query(() => listPublicLeagueTeams()),
    login: publicProcedure
      .input(z.object({ teamId: z.string().min(1), pin: z.string().min(1).max(8) }))
      .mutation(async ({ input, ctx }) => {
        const team = await verifyLeagueTeamPin(input.teamId, input.pin);
        if (!team) throw new Error("Incorrect PIN. Please try again.");
        await writeWrcTeamSession(ctx.res, ctx.req, { teamId: team.id, isCommissioner: team.is_commissioner });
        return team;
      }),
    session: publicProcedure.query(async ({ ctx }) => {
      const session = await readWrcTeamSession(ctx.req);
      return session ? getPublicLeagueTeam(session.teamId) : null;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearWrcTeamSession(ctx.res, ctx.req);
      return { success: true };
    }),
    lineups: publicProcedure
      .input(z.object({ teamId: z.string().min(1), week: z.number().int().min(1).max(22), season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from("lineups")
          .select("slot, player_name")
          .eq("team_id", input.teamId)
          .eq("week", input.week)
          .eq("season", input.season);
        if (error) throw new Error("Unable to load lineup");
        return data ?? [];
      }),
    saveLineup: teamProcedure
      .input(z.object({
        week: z.number().int().min(1).max(22),
        season: z.number().int().min(2020).max(2100),
        rows: z.array(z.object({
          slot: z.string().min(1).max(32),
          player_id: z.string().min(1).max(128),
          player_name: z.string().min(1).max(128),
          is_bench: z.boolean(),
        })).min(1).max(30),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { error: deleteError } = await supabaseAdmin
          .from("lineups")
          .delete()
          .eq("team_id", teamId)
          .eq("week", input.week)
          .eq("season", input.season);
        if (deleteError) throw new Error("Unable to replace lineup");

        const { error: insertError } = await supabaseAdmin.from("lineups").insert(
          input.rows.map(row => ({ ...row, team_id: teamId, week: input.week, season: input.season })),
        );
        if (insertError) throw new Error("Unable to save lineup");
        return { teamId, saved: input.rows.length };
      }),
    draftQueue: teamProcedure
      .input(z.object({ season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input, ctx }) => {
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .select("id, team_id, player_name, player_pos, player_nfl_team, rank, season")
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)
          .order("rank", { ascending: true });
        if (error) throw new Error("Unable to load draft queue");
        return data ?? [];
      }),
    addDraftQueueItem: teamProcedure
      .input(z.object({
        season: z.number().int().min(2020).max(2100),
        playerName: z.string().min(1).max(128),
        playerPos: z.string().min(1).max(8),
        playerNflTeam: z.string().max(8).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("draft_queue")
          .select("id, rank")
          .eq("team_id", teamId)
          .eq("season", input.season)
          .eq("player_name", input.playerName)
          .maybeSingle();
        if (existingError) throw new Error("Unable to check draft queue");
        if (existing) throw new Error("This player is already in your queue");

        const { data: last, error: lastError } = await supabaseAdmin
          .from("draft_queue")
          .select("rank")
          .eq("team_id", teamId)
          .eq("season", input.season)
          .order("rank", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastError) throw new Error("Unable to load draft queue");
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .insert({
            team_id: teamId,
            season: input.season,
            player_name: input.playerName,
            player_pos: input.playerPos,
            player_nfl_team: input.playerNflTeam,
            rank: Number(last?.rank ?? 0) + 1,
          })
          .select("id, team_id, player_name, player_pos, player_nfl_team, rank, season")
          .single();
        if (error || !data) throw new Error("Unable to add draft queue player");
        return data;
      }),
    removeDraftQueueItem: teamProcedure
      .input(z.object({ id: z.number().int().positive(), season: z.number().int().min(2020).max(2100) }))
      .mutation(async ({ input, ctx }) => {
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .delete()
          .eq("id", input.id)
          .eq("season", input.season)
          .eq("team_id", ctx.teamSession.teamId)
          .select("id");
        if (error || !data?.length) throw new Error("Draft queue item was not found");
        return { id: input.id };
      }),
    reorderDraftQueue: teamProcedure
      .input(z.object({ season: z.number().int().min(2020).max(2100), orderedIds: z.array(z.number().int().positive()).min(1).max(300) }))
      .mutation(async ({ input, ctx }) => {
        const { data: ownedRows, error: ownedError } = await supabaseAdmin
          .from("draft_queue")
          .select("id")
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)
          .in("id", input.orderedIds);
        if (ownedError || (ownedRows?.length ?? 0) !== input.orderedIds.length) throw new Error("One or more draft queue items are not owned by your team");
        const results = await Promise.all(input.orderedIds.map((id, index) => supabaseAdmin
          .from("draft_queue")
          .update({ rank: index + 1 })
          .eq("id", id)
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)));
        if (results.some(result => result.error)) throw new Error("Unable to reorder draft queue");
        return { saved: input.orderedIds.length };
      }),
    watchlist: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("watchlist")
        .select("player_name, pos, nfl_team, added_at")
        .eq("team_id", ctx.teamSession.teamId)
        .order("added_at", { ascending: false });
      if (error) throw new Error("Unable to load watchlist");
      return data ?? [];
    }),
    toggleWatchlistPlayer: teamProcedure
      .input(z.object({
        playerName: z.string().min(1).max(128),
        pos: z.string().min(1).max(8),
        nflTeam: z.string().min(1).max(8),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("watchlist")
          .select("player_name")
          .eq("team_id", teamId)
          .eq("player_name", input.playerName)
          .maybeSingle();
        if (existingError) throw new Error("Unable to check watchlist");

        if (existing) {
          const { data, error } = await supabaseAdmin
            .from("watchlist")
            .delete()
            .eq("team_id", teamId)
            .eq("player_name", input.playerName)
            .select("player_name");
          if (error || !data?.length) throw new Error("Unable to remove player from watchlist");
          return { action: "removed" as const, playerName: input.playerName };
        }

        const addedAt = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("watchlist")
          .insert({
            team_id: teamId,
            player_name: input.playerName,
            pos: input.pos,
            nfl_team: input.nflTeam,
            added_at: addedAt,
          })
          .select("player_name, pos, nfl_team, added_at")
          .single();
        if (error || !data) throw new Error("Unable to add player to watchlist");
        return { action: "added" as const, player: data };
      }),
    faabBidRoster: teamProcedure.query(async ({ ctx }) => {
      const teamId = ctx.teamSession.teamId;
      const [{ data: roster, error: rosterError }, { data: team, error: teamError }] = await Promise.all([
        supabaseAdmin
          .from("players")
          .select("id, name, position, nfl_team")
          .eq("team_id", teamId)
          .order("position"),
        supabaseAdmin
          .from("teams")
          .select("faab")
          .eq("id", teamId)
          .single(),
      ]);
      if (rosterError || teamError || !team) throw new Error("Unable to load FAAB bid details");
      return { roster: roster ?? [], faab: Number(team.faab ?? 0) };
    }),
    submitFaabBid: teamProcedure
      .input(z.object({
        playerId: z.string().min(1).max(128),
        playerName: z.string().min(1).max(128),
        playerPos: z.string().min(1).max(8),
        playerNflTeam: z.string().min(1).max(8),
        bidAmount: z.number().int().min(0).max(10_000),
        dropPlayerId: z.string().min(1).max(128).nullable(),
        week: z.number().int().min(1).max(22),
        season: z.number().int().min(2020).max(2100),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const [{ data: team, error: teamError }, { data: roster, error: rosterError }, { data: targetPlayer, error: targetPlayerError }] = await Promise.all([
          supabaseAdmin.from("teams").select("name, faab").eq("id", teamId).single(),
          supabaseAdmin.from("players").select("id").eq("team_id", teamId),
          supabaseAdmin.from("players").select("team_id").eq("name", input.playerName).maybeSingle(),
        ]);
        if (teamError || !team || rosterError || targetPlayerError) throw new Error("Unable to validate this FAAB bid");
        const faab = Number(team.faab ?? 0);
        if (input.bidAmount > faab) throw new Error(`Bid exceeds your FAAB balance ($${faab} remaining).`);
        if (targetPlayer?.team_id) throw new Error("This player is already on a WRC roster.");
        if ((roster?.length ?? 0) >= 18 && !input.dropPlayerId) throw new Error("Select a player to drop before bidding with a full roster.");

        let dropPlayer: { id: string; name: string } | null = null;
        if (input.dropPlayerId) {
          const { data, error } = await supabaseAdmin
            .from("players")
            .select("id, name")
            .eq("id", input.dropPlayerId)
            .eq("team_id", teamId)
            .maybeSingle();
          if (error || !data) throw new Error("The selected drop player is not on your roster.");
          dropPlayer = data;
        }

        const { error } = await supabaseAdmin.from("faab_bids").insert({
          team_id: teamId,
          team_name: team.name,
          player_id: input.playerId,
          player_name: input.playerName,
          player_pos: input.playerPos,
          player_nfl_team: input.playerNflTeam,
          bid_amount: input.bidAmount,
          drop_player_id: dropPlayer?.id ?? null,
          drop_player_name: dropPlayer?.name ?? null,
          status: "pending",
          week: input.week,
          season: input.season,
        });
        if (error) throw new Error("Unable to submit FAAB bid");
        return { submitted: true, bidAmount: input.bidAmount };
      }),
    commissionerFaabBids: commissionerProcedure
      .input(z.object({ week: z.number().int().min(1).max(22), season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from("faab_bids")
          .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name, status, week, season, created_at")
          .eq("week", input.week)
          .eq("season", input.season)
          .order("player_name", { ascending: true })
          .order("bid_amount", { ascending: false });
        if (error) throw new Error("Unable to load FAAB bids");
        return data ?? [];
      }),
    awardFaabBid: commissionerProcedure
      .input(z.object({ bidId: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        const { data: bid, error: bidError } = await supabaseAdmin
          .from("faab_bids")
          .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name, status, week, season")
          .eq("id", input.bidId)
          .single();
        if (bidError || !bid || bid.status !== "pending") throw new Error("This pending FAAB bid was not found.");

        const resolvedAt = new Date().toISOString();
        const [{ error: winError }, { error: loseError }, { data: winningTeam, error: teamError }] = await Promise.all([
          supabaseAdmin.from("faab_bids").update({ status: "won", resolved_at: resolvedAt }).eq("id", bid.id),
          supabaseAdmin.from("faab_bids").update({ status: "lost", resolved_at: resolvedAt })
            .eq("player_id", bid.player_id).eq("week", bid.week).eq("season", bid.season).eq("status", "pending").neq("id", bid.id),
          supabaseAdmin.from("teams").select("faab").eq("id", bid.team_id).single(),
        ]);
        if (winError || loseError || teamError || !winningTeam) throw new Error("Unable to resolve FAAB bids");
        const remainingFaab = Math.max(0, Number(winningTeam.faab ?? 0) - Number(bid.bid_amount));
        const { error: faabError } = await supabaseAdmin.from("teams").update({ faab: remainingFaab }).eq("id", bid.team_id);
        if (faabError) throw new Error("Unable to deduct the winning FAAB bid");

        const { error: addError } = await supabaseAdmin.from("players")
          .update({ team_id: bid.team_id, acquisition: "FA" })
          .eq("name", bid.player_name);
        if (addError) throw new Error("Unable to add the awarded player to the roster");
        if (bid.drop_player_id) {
          const { error: dropError } = await supabaseAdmin.from("players")
            .update({ team_id: null, acquisition: "FA" })
            .eq("id", bid.drop_player_id)
            .eq("team_id", bid.team_id);
          if (dropError) throw new Error("Unable to drop the selected player");
        }

        const moves = [{
          move_type: "ADD",
          team_name: bid.team_name,
          owner: bid.team_name,
          player_name: bid.player_name,
          player_pos: bid.player_pos,
          player_nfl_team: bid.player_nfl_team,
          faab_spent: bid.bid_amount,
          note: `FAAB $${bid.bid_amount} — Week ${bid.week}`,
        }];
        if (bid.drop_player_name) moves.push({
          move_type: "DROP",
          team_name: bid.team_name,
          owner: bid.team_name,
          player_name: bid.drop_player_name,
          player_pos: "—",
          player_nfl_team: "FA",
          faab_spent: null,
          note: `Dropped to make room for ${bid.player_name}`,
        });
        const { error: moveError } = await supabaseAdmin.from("roster_moves").insert(moves);
        if (moveError) throw new Error("FAAB was processed, but transaction history could not be written");
        return { awarded: true, bidId: bid.id, playerName: bid.player_name, teamName: bid.team_name, remainingFaab };
      }),
    protections: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("protections")
        .select("player_id, tier, forfeited_round")
        .eq("team_id", ctx.teamSession.teamId);
      if (error) throw new Error("Unable to load protections");
      return (data ?? []).map(row => ({ playerId: row.player_id, assignedRound: row.forfeited_round }));
    }),
    saveProtections: teamProcedure
      .input(z.object({
        slots: z.array(z.object({
          playerId: z.string().min(1).max(128),
          assignedRound: z.number().int().min(1).max(18).nullable(),
        })).max(3),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { data: roster, error: rosterError } = await supabaseAdmin
          .from("players")
          .select("id, draft_round")
          .eq("team_id", teamId);
        if (rosterError) throw new Error("Unable to validate your roster protections");
        const validated = validateProtectionSubmission(
          input.slots,
          (roster ?? []).map(player => ({ id: player.id, draftRound: player.draft_round })),
        );
        const { error: deleteError } = await supabaseAdmin
          .from("protections")
          .delete()
          .eq("team_id", teamId);
        if (deleteError) throw new Error("Unable to replace protections");
        if (validated.length) {
          const { error: insertError } = await supabaseAdmin.from("protections").insert(
            validated.map(slot => ({
              team_id: teamId,
              player_id: slot.playerId,
              tier: slot.tier,
              forfeited_round: slot.forfeitedRound,
              submitted: true,
            })),
          );
          if (insertError) throw new Error("Unable to save protections");
        }
        return { slots: validated.map(slot => ({ playerId: slot.playerId, assignedRound: slot.forfeitedRound })) };
      }),
    tradeTeamData: teamProcedure
      .input(z.object({ teamName: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const { data: team, error: teamError } = await supabaseAdmin
          .from("teams")
          .select("id, faab")
          .eq("name", input.teamName)
          .maybeSingle();
        if (teamError || !team) throw new Error("Trade team was not found");
        const [{ data: roster, error: rosterError }, { data: picks, error: picksError }] = await Promise.all([
          supabaseAdmin.from("players").select("id, name, position, nfl_team").eq("team_id", team.id).order("position").order("name"),
          supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", team.id).in("year", [2026, 2027]).order("year").order("round"),
        ]);
        if (rosterError || picksError) throw new Error("Unable to load trade assets");
        return {
          teamId: team.id,
          faab: Number(team.faab ?? 0),
          roster: roster ?? [],
          ownedPicks: (picks ?? []).map(pick => ({ year: pick.year, round: pick.round, originalTeamId: pick.original_team_id })),
        };
      }),
    tradeInbox: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("trade_proposals")
        .select("id, from_team_id, to_team_id, give_player_ids, receive_player_ids, faab_amount, receive_faab_amount, give_picks, receive_picks, note, status, created_at")
        .eq("to_team_id", ctx.teamSession.teamId)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Unable to load trade proposals");
      return data ?? [];
    }),
    createTradeProposal: teamProcedure
      .input(z.object({
        toTeamId: z.string().min(1).max(128),
        givePlayerNames: z.array(z.string().min(1).max(128)).max(30),
        receivePlayerNames: z.array(z.string().min(1).max(128)).max(30),
        giveFaab: z.number().int().min(0).max(10_000),
        receiveFaab: z.number().int().min(0).max(10_000),
        givePicks: z.array(z.object({ year: z.number().int().min(2026).max(2027), round: z.number().int().min(1).max(18) })).max(36),
        receivePicks: z.array(z.object({ year: z.number().int().min(2026).max(2027), round: z.number().int().min(1).max(18) })).max(36),
        note: z.string().max(1_000),
        counterToId: z.string().uuid().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const fromTeamId = ctx.teamSession.teamId;
        if (input.toTeamId === fromTeamId) throw new Error("You cannot propose a trade to your own team.");
        const unique = <T,>(items: T[], key: (item: T) => string) => new Set(items.map(key)).size === items.length;
        if (!unique(input.givePlayerNames, name => name.toLowerCase()) || !unique(input.receivePlayerNames, name => name.toLowerCase())
          || !unique(input.givePicks, pick => `${pick.year}-${pick.round}`) || !unique(input.receivePicks, pick => `${pick.year}-${pick.round}`)) {
          throw new Error("Each trade asset may only be included once.");
        }
        const [fromTeamResponse, toTeamResponse, givePlayersResponse, receivePlayersResponse, givePicksResponse, receivePicksResponse] = await Promise.all([
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", fromTeamId).single(),
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", input.toTeamId).single(),
          input.givePlayerNames.length ? supabaseAdmin.from("players").select("name").eq("team_id", fromTeamId).in("name", input.givePlayerNames) : Promise.resolve({ data: [], error: null }),
          input.receivePlayerNames.length ? supabaseAdmin.from("players").select("name").eq("team_id", input.toTeamId).in("name", input.receivePlayerNames) : Promise.resolve({ data: [], error: null }),
          input.givePicks.length ? supabaseAdmin.from("traded_picks").select("year, round").eq("current_owner_team_id", fromTeamId).in("year", input.givePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
          input.receivePicks.length ? supabaseAdmin.from("traded_picks").select("year, round").eq("current_owner_team_id", input.toTeamId).in("year", input.receivePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (fromTeamResponse.error || toTeamResponse.error || !fromTeamResponse.data || !toTeamResponse.data
          || givePlayersResponse.error || receivePlayersResponse.error || givePicksResponse.error || receivePicksResponse.error) {
          throw new Error("Unable to validate trade assets");
        }
        if (Number(fromTeamResponse.data.faab ?? 0) < input.giveFaab || Number(toTeamResponse.data.faab ?? 0) < input.receiveFaab) {
          throw new Error("One team no longer has the FAAB included in this proposal.");
        }
        if ((givePlayersResponse.data?.length ?? 0) !== input.givePlayerNames.length || (receivePlayersResponse.data?.length ?? 0) !== input.receivePlayerNames.length) {
          throw new Error("One or more selected players are no longer on the proposed roster.");
        }
        const hasEveryPick = (owned: Array<{ year: number; round: number }> | null, picks: Array<{ year: number; round: number }>) =>
          picks.every(pick => owned?.some(candidate => candidate.year === pick.year && candidate.round === pick.round));
        if (!hasEveryPick(givePicksResponse.data, input.givePicks) || !hasEveryPick(receivePicksResponse.data, input.receivePicks)) {
          throw new Error("One or more selected draft picks are no longer owned by the proposed team.");
        }
        if (input.counterToId) {
          const { data: original, error } = await supabaseAdmin.from("trade_proposals")
            .select("id, from_team_id, to_team_id, status").eq("id", input.counterToId).single();
          if (error || !original || original.status !== "pending" || original.to_team_id !== fromTeamId || original.from_team_id !== input.toTeamId) {
            throw new Error("Only the recipient of a pending proposal may send its counter-offer.");
          }
        }
        const { data: proposal, error: insertError } = await supabaseAdmin.from("trade_proposals").insert({
          from_team_id: fromTeamId,
          to_team_id: input.toTeamId,
          give_player_ids: input.givePlayerNames,
          receive_player_ids: input.receivePlayerNames,
          faab_amount: input.giveFaab,
          receive_faab_amount: input.receiveFaab,
          give_picks: input.givePicks,
          receive_picks: input.receivePicks,
          note: input.note.trim(),
          status: "pending",
          counter_to_id: input.counterToId,
        }).select("id").single();
        if (insertError || !proposal) throw new Error("Unable to create trade proposal");
        if (input.counterToId) {
          const { error } = await supabaseAdmin.from("trade_proposals").update({ status: "countered" }).eq("id", input.counterToId);
          if (error) throw new Error("Counter-offer was created, but the original proposal could not be closed.");
        }
        return { id: proposal.id, recipientName: toTeamResponse.data.name, isCounter: Boolean(input.counterToId) };
      }),
    respondToTradeProposal: teamProcedure
      .input(z.object({ proposalId: z.string().uuid(), action: z.enum(["accepted", "declined"]) }))
      .mutation(async ({ input, ctx }) => {
        const recipientTeamId = ctx.teamSession.teamId;
        const { data: proposal, error: proposalError } = await supabaseAdmin.from("trade_proposals")
          .select("id, from_team_id, to_team_id, give_player_ids, receive_player_ids, faab_amount, receive_faab_amount, give_picks, receive_picks, note, status")
          .eq("id", input.proposalId).eq("to_team_id", recipientTeamId).single();
        if (proposalError || !proposal || proposal.status !== "pending") throw new Error("This pending proposal is not available to your team.");
        if (input.action === "declined") {
          const { error } = await supabaseAdmin.from("trade_proposals").update({ status: "declined" }).eq("id", proposal.id).eq("to_team_id", recipientTeamId);
          if (error) throw new Error("Unable to decline trade proposal");
          return { status: "declined" as const };
        }

        const givePlayers = (proposal.give_player_ids ?? []) as string[];
        const receivePlayers = (proposal.receive_player_ids ?? []) as string[];
        const givePicks = (proposal.give_picks ?? []) as Array<{ year: number; round: number }>;
        const receivePicks = (proposal.receive_picks ?? []) as Array<{ year: number; round: number }>;
        const [fromTeamResponse, toTeamResponse, fromPlayersResponse, toPlayersResponse, fromPicksResponse, toPicksResponse] = await Promise.all([
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", proposal.from_team_id).single(),
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", proposal.to_team_id).single(),
          givePlayers.length ? supabaseAdmin.from("players").select("name, position, nfl_team").eq("team_id", proposal.from_team_id).in("name", givePlayers) : Promise.resolve({ data: [], error: null }),
          receivePlayers.length ? supabaseAdmin.from("players").select("name, position, nfl_team").eq("team_id", proposal.to_team_id).in("name", receivePlayers) : Promise.resolve({ data: [], error: null }),
          givePicks.length ? supabaseAdmin.from("traded_picks").select("year, round").eq("current_owner_team_id", proposal.from_team_id).in("year", givePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
          receivePicks.length ? supabaseAdmin.from("traded_picks").select("year, round").eq("current_owner_team_id", proposal.to_team_id).in("year", receivePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (fromTeamResponse.error || toTeamResponse.error || !fromTeamResponse.data || !toTeamResponse.data || fromPlayersResponse.error || toPlayersResponse.error || fromPicksResponse.error || toPicksResponse.error) {
          throw new Error("Unable to validate trade assets for acceptance.");
        }
        const hasEveryPick = (owned: Array<{ year: number; round: number }> | null, picks: Array<{ year: number; round: number }>) =>
          picks.every(pick => owned?.some(candidate => candidate.year === pick.year && candidate.round === pick.round));
        if ((fromPlayersResponse.data?.length ?? 0) !== givePlayers.length || (toPlayersResponse.data?.length ?? 0) !== receivePlayers.length
          || !hasEveryPick(fromPicksResponse.data, givePicks) || !hasEveryPick(toPicksResponse.data, receivePicks)
          || Number(fromTeamResponse.data.faab ?? 0) < Number(proposal.faab_amount ?? 0)
          || Number(toTeamResponse.data.faab ?? 0) < Number(proposal.receive_faab_amount ?? 0)) {
          throw new Error("This proposal can no longer be accepted because one or more assets changed.");
        }

        const fromTeam = fromTeamResponse.data;
        const toTeam = toTeamResponse.data;
        const [outgoingMoves, incomingMoves] = await Promise.all([
          Promise.all(givePlayers.map(name => supabaseAdmin.from("players").update({ team_id: toTeam.id }).eq("name", name).eq("team_id", fromTeam.id))),
          Promise.all(receivePlayers.map(name => supabaseAdmin.from("players").update({ team_id: fromTeam.id }).eq("name", name).eq("team_id", toTeam.id))),
        ]);
        if ([...outgoingMoves, ...incomingMoves].some(result => result.error)) throw new Error("Unable to move all trade players.");
        const fromFaab = Number(fromTeam.faab ?? 0) - Number(proposal.faab_amount ?? 0) + Number(proposal.receive_faab_amount ?? 0);
        const toFaab = Number(toTeam.faab ?? 0) - Number(proposal.receive_faab_amount ?? 0) + Number(proposal.faab_amount ?? 0);
        const [{ error: fromFaabError }, { error: toFaabError }, ...pickTransfers] = await Promise.all([
          supabaseAdmin.from("teams").update({ faab: fromFaab }).eq("id", fromTeam.id),
          supabaseAdmin.from("teams").update({ faab: toFaab }).eq("id", toTeam.id),
          ...givePicks.map(pick => supabaseAdmin.from("traded_picks").update({ current_owner_team_id: toTeam.id }).eq("year", pick.year).eq("round", pick.round).eq("current_owner_team_id", fromTeam.id)),
          ...receivePicks.map(pick => supabaseAdmin.from("traded_picks").update({ current_owner_team_id: fromTeam.id }).eq("year", pick.year).eq("round", pick.round).eq("current_owner_team_id", toTeam.id)),
        ]);
        if (fromFaabError || toFaabError || pickTransfers.some(result => result.error)) throw new Error("Unable to transfer all trade FAAB or draft picks.");
        const { error: statusError } = await supabaseAdmin.from("trade_proposals").update({ status: "accepted" }).eq("id", proposal.id).eq("to_team_id", recipientTeamId);
        if (statusError) throw new Error("Trade assets moved, but the proposal could not be finalized.");

        const playerMeta = new Map([...fromPlayersResponse.data ?? [], ...toPlayersResponse.data ?? []].map(player => [player.name, player]));
        const transactionRows = [
          ...givePlayers.map(name => ({ move_type: "TRADE", team_name: fromTeam.name, owner: fromTeam.name, player_name: name, player_pos: playerMeta.get(name)?.position ?? "—", player_nfl_team: playerMeta.get(name)?.nfl_team ?? "—", faab_spent: null, note: `Traded to ${toTeam.name}` })),
          ...receivePlayers.map(name => ({ move_type: "TRADE", team_name: toTeam.name, owner: toTeam.name, player_name: name, player_pos: playerMeta.get(name)?.position ?? "—", player_nfl_team: playerMeta.get(name)?.nfl_team ?? "—", faab_spent: null, note: `Traded to ${fromTeam.name}` })),
          ...givePicks.map(pick => ({ move_type: "TRADE", team_name: fromTeam.name, owner: fromTeam.name, player_name: `${pick.year} Rd ${pick.round} Pick`, player_pos: "PICK", player_nfl_team: "—", faab_spent: null, note: `Pick traded to ${toTeam.name}` })),
          ...receivePicks.map(pick => ({ move_type: "TRADE", team_name: toTeam.name, owner: toTeam.name, player_name: `${pick.year} Rd ${pick.round} Pick`, player_pos: "PICK", player_nfl_team: "—", faab_spent: null, note: `Pick traded to ${fromTeam.name}` })),
        ];
        if (transactionRows.length) {
          const { error } = await supabaseAdmin.from("roster_moves").insert(transactionRows);
          if (error) throw new Error("Trade completed, but transaction history could not be written.");
        }
        return { status: "accepted" as const, fromTeamName: fromTeam.name, toTeamName: toTeam.name };
      }),
    commissionerDraftAction: commissionerProcedure
      .input(z.object({ action: z.enum(["start", "togglePause", "skip", "reset"]) }))
      .mutation(async ({ input }) => {
        const { data: state, error: stateError } = await supabaseAdmin.from("draft_state").select("started, paused, complete, current_round, current_pick").eq("id", 1).single();
        if (stateError || !state) throw new Error("Unable to load draft state");
        if (input.action === "reset") {
          const { error: deleteError } = await supabaseAdmin.from("draft_picks").delete().neq("id", 0);
          if (deleteError) throw new Error("Unable to reset draft picks");
          const { error } = await supabaseAdmin.from("draft_state").update({
            started: false, paused: false, complete: false, current_round: 1, current_pick: 0,
            timer_seconds: WRC_DRAFT_TIMER_SECONDS, updated_at: new Date().toISOString(),
          }).eq("id", 1);
          if (error) throw new Error("Unable to reset draft state");
          return { action: "reset" as const };
        }
        const patch = input.action === "start"
          ? { started: true, paused: false, complete: false, current_round: 1, current_pick: 0, timer_seconds: WRC_DRAFT_TIMER_SECONDS }
          : input.action === "togglePause"
            ? { paused: !state.paused }
            : nextDraftState(state.current_round, state.current_pick);
        const { error } = await supabaseAdmin.from("draft_state").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) throw new Error("Unable to update draft state");
        return { action: input.action };
      }),
    makeDraftPick: teamProcedure
      .input(z.object({ playerName: z.string().min(1).max(128), playerPos: z.string().min(1).max(8), playerNflTeam: z.string().min(1).max(8) }))
      .mutation(async ({ input, ctx }) => {
        const { data: state, error: stateError } = await supabaseAdmin.from("draft_state")
          .select("started, paused, complete, current_round, current_pick").eq("id", 1).single();
        if (stateError || !state) throw new Error("Unable to load draft state");
        if (!state.started || state.paused || state.complete) throw new Error("The draft is not currently accepting picks.");
        const overall = (state.current_round - 1) * WRC_DRAFT_TOTAL_TEAMS + state.current_pick + 1;
        const currentPick = DRAFT_PICKS_2026.find(pick => pick.overall === overall);
        if (!currentPick) throw new Error("Unable to identify the current draft pick.");
        const expectedTeamId = WRC_DRAFT_OWNER_TEAM_IDS[currentPick.owner];
        if (!ctx.teamSession.isCommissioner && ctx.teamSession.teamId !== expectedTeamId) throw new Error("It is not your team’s turn to draft.");
        const { data: existingPick, error: existingPickError } = await supabaseAdmin.from("draft_picks").select("id").eq("player_name", input.playerName).maybeSingle();
        if (existingPickError) throw new Error("Unable to verify player availability");
        if (existingPick) throw new Error("This player has already been drafted.");

        const teamNameResponse = await supabaseAdmin.from("teams").select("name").eq("id", expectedTeamId).single();
        if (teamNameResponse.error || !teamNameResponse.data) throw new Error("Unable to identify the drafting team.");
        const { data: savedPick, error: pickError } = await supabaseAdmin.from("draft_picks").insert({
          round: state.current_round,
          pick: state.current_pick,
          overall,
          team_name: teamNameResponse.data.name,
          owner: currentPick.owner,
          player_name: input.playerName,
          player_pos: input.playerPos,
          player_nfl_team: input.playerNflTeam,
        }).select("id, round, pick, overall, team_name, owner, player_name, player_pos, player_nfl_team, picked_at").single();
        if (pickError || !savedPick) throw new Error("Unable to record draft pick");
        const { error: rosterError } = await supabaseAdmin.from("players").update({
          team_id: expectedTeamId,
          acquisition: `Rd ${state.current_round}`,
          draft_round: state.current_round,
        }).ilike("name", input.playerName);
        if (rosterError) throw new Error("Draft pick was saved, but the team roster could not be updated.");
        const { error: advanceError } = await supabaseAdmin.from("draft_state").update({
          ...nextDraftState(state.current_round, state.current_pick),
          updated_at: new Date().toISOString(),
        }).eq("id", 1).eq("current_round", state.current_round).eq("current_pick", state.current_pick);
        if (advanceError) throw new Error("Draft pick was saved, but the draft clock could not advance.");
        return { pick: savedPick, complete: state.current_round === WRC_DRAFT_TOTAL_ROUNDS && state.current_pick === WRC_DRAFT_TOTAL_TEAMS - 1 };
      }),
    commissionerFinalizeWeeklyResult: commissionerProcedure
      .input(z.object({ resultId: z.number().int().positive(), homeScore: z.number().finite().min(0).max(500), awayScore: z.number().finite().min(0).max(500) }))
      .mutation(async ({ input }) => {
        const { data: target, error: targetError } = await supabaseAdmin.from("weekly_results")
          .select("id, week, season").eq("id", input.resultId).single();
        if (targetError || !target) throw new Error("The selected weekly result was not found.");
        const { error: resultError } = await supabaseAdmin.from("weekly_results").update({
          home_score: input.homeScore,
          away_score: input.awayScore,
          is_final: true,
        }).eq("id", target.id);
        if (resultError) throw new Error("Unable to finalize the weekly result.");

        const [{ data: seasonResults, error: seasonResultsError }, { data: standings, error: standingsError }] = await Promise.all([
          supabaseAdmin.from("weekly_results").select("week, home_owner, away_owner, home_team_id, away_team_id, home_score, away_score, is_final").eq("season", target.season).eq("is_final", true).order("week"),
          supabaseAdmin.from("team_standings").select("team_id, wins, losses, ties, pts_for, pts_against, h2h_wins, h2h_losses, median_wins, median_losses, div_wins, div_losses, streak, division"),
        ]);
        if (seasonResultsError || standingsError || !standings) throw new Error("Result saved, but standings could not be recalculated.");
        const divisionByTeam = new Map(standings.map(standing => [standing.team_id, standing.division]));
        const recalculated = new Map(standings.map(standing => [standing.team_id, {
          wins: 0, losses: 0, ties: 0, pts_for: 0, pts_against: 0, h2h_wins: 0, h2h_losses: 0,
          median_wins: 0, median_losses: 0, div_wins: 0, div_losses: 0, streak: "",
        }]));
        const allSeasonResults = seasonResults ?? [];
        const resultsByWeek = new Map<number, typeof allSeasonResults>();
        for (const result of allSeasonResults) {
          const rows = resultsByWeek.get(result.week) ?? [];
          rows.push(result);
          resultsByWeek.set(result.week, rows);
        }
        const addOutcome = (teamId: string, ownScore: number, opponentScore: number, median: number, divisionGame: boolean) => {
          const row = recalculated.get(teamId);
          if (!row) return;
          row.pts_for += ownScore;
          row.pts_against += opponentScore;
          if (ownScore > opponentScore) {
            row.wins += 1; row.h2h_wins += 1; if (divisionGame) row.div_wins += 1;
            row.streak = row.streak.startsWith("W") ? `W${Number(row.streak.slice(1)) + 1}` : "W1";
          } else if (ownScore < opponentScore) {
            row.losses += 1; row.h2h_losses += 1; if (divisionGame) row.div_losses += 1;
            row.streak = row.streak.startsWith("L") ? `L${Number(row.streak.slice(1)) + 1}` : "L1";
          } else {
            row.ties += 1;
            row.streak = row.streak.startsWith("T") ? `T${Number(row.streak.slice(1)) + 1}` : "T1";
          }
          if (ownScore > median) row.median_wins += 1;
          else row.median_losses += 1;
        };
        Array.from(resultsByWeek.values()).forEach(rows => {
          const scores: number[] = rows.flatMap(row => [Number(row.home_score), Number(row.away_score)]).sort((a: number, b: number) => a - b);
          const middle = Math.floor(scores.length / 2);
          const median = scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
          rows.forEach(row => {
            const home = Number(row.home_score);
            const away = Number(row.away_score);
            const divisionGame = divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id);
            addOutcome(row.home_team_id, home, away, median, divisionGame);
            addOutcome(row.away_team_id, away, home, median, divisionGame);
          });
        });
        const updates = await Promise.all(Array.from(recalculated.entries()).map(([teamId, values]) => supabaseAdmin.from("team_standings").update({
          ...values,
          streak: values.streak || "—",
        }).eq("team_id", teamId)));
        if (updates.some(update => update.error)) throw new Error("Result saved, but one or more standings rows could not be updated.");
        const targetWeekRows = resultsByWeek.get(target.week) ?? [];
        const targetScores: number[] = targetWeekRows.flatMap(row => [Number(row.home_score), Number(row.away_score)]).sort((a: number, b: number) => a - b);
        const targetMiddle = Math.floor(targetScores.length / 2);
        const median = targetScores.length % 2 ? targetScores[targetMiddle] : (targetScores[targetMiddle - 1] + targetScores[targetMiddle]) / 2;
        await supabaseAdmin.from("weekly_results").update({ league_median: median }).eq("season", target.season).eq("week", target.week);
        return { saved: true, median };
      }),
    submitManualTransaction: teamProcedure
      .input(z.object({
        targetTeamId: z.string().min(1).max(128),
        addPlayerName: z.string().min(1).max(128),
        addPlayerPos: z.string().min(1).max(8),
        addPlayerNflTeam: z.string().min(1).max(8),
        dropPlayerName: z.string().min(1).max(128),
        faab: z.number().int().min(0).max(10_000),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.teamSession.isCommissioner && input.targetTeamId !== ctx.teamSession.teamId) {
          throw new Error("You may only submit a transaction for your own team.");
        }
        const { data: targetTeam, error: teamError } = await supabaseAdmin.from("teams")
          .select("id, team_name, owner, faab").eq("id", input.targetTeamId).single();
        if (teamError || !targetTeam) throw new Error("The selected team was not found.");
        const balance = Number(targetTeam.faab ?? 0);
        if (input.faab > balance) throw new Error(`FAAB bid exceeds the team’s available balance ($${balance}).`);
        const { data: addPlayer, error: addPlayerError } = await supabaseAdmin.from("players")
          .select("team_id").ilike("name", input.addPlayerName).maybeSingle();
        if (addPlayerError) throw new Error("Unable to verify the added player.");
        if (addPlayer?.team_id) throw new Error("The selected player is already on a WRC roster.");
        const { data: dropPlayer, error: dropPlayerError } = await supabaseAdmin.from("players")
          .select("id").ilike("name", input.dropPlayerName).eq("team_id", targetTeam.id).maybeSingle();
        if (dropPlayerError) throw new Error("Unable to verify the drop player.");
        if (!dropPlayer) throw new Error("The selected drop player is not on this roster.");
        const { error: movesError } = await supabaseAdmin.from("roster_moves").insert([
          {
            move_type: "ADD",
            team_name: targetTeam.team_name,
            owner: targetTeam.owner,
            player_name: input.addPlayerName,
            player_pos: input.addPlayerPos,
            player_nfl_team: input.addPlayerNflTeam,
            faab_spent: input.faab,
          },
          {
            move_type: "DROP",
            team_name: targetTeam.team_name,
            owner: targetTeam.owner,
            player_name: input.dropPlayerName,
            player_pos: "—",
            player_nfl_team: "FA",
            faab_spent: null,
          },
        ]);
        if (movesError) throw new Error("Unable to write the transaction history.");
        if (input.faab > 0) {
          const { error: faabError } = await supabaseAdmin.from("teams")
            .update({ faab: balance - input.faab }).eq("id", targetTeam.id);
          if (faabError) throw new Error("Transaction was recorded, but FAAB could not be deducted.");
        }
        return { submitted: true, teamName: targetTeam.team_name, remainingFaab: balance - input.faab };
      }),
  }),

  fantasyPros: router({
    news: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), fpid: z.number().int().positive().optional(), feedVersion: z.number().int().optional() }).optional())
      .query(async ({ input }) => {
        const news = await getFantasyProsNews(input?.limit ?? 100, input?.fpid);
        if (input?.fpid) return news;
        const rankGroups = await Promise.all(["QB", "RB", "WR", "TE", "K"].map(position => getFantasyProsRanks(position, 1)));
        const current = attachFantasyProsPlayerNames(news, rankGroups.flat());
        const [archived] = await Promise.all([
          getArchivedFantasyProsNews(),
          archiveFantasyProsNews(current).catch(error => console.warn("[FantasyPros archive] Current-feed archive failed:", error)),
        ]);
        return mergeFantasyProsNews(current, archived);
      }),
    rosterNews: publicProcedure
      .input(z.object({
        players: z.array(z.object({ name: z.string().min(1), pos: z.string().optional() })).min(1).max(30),
        feedVersion: z.literal(2).optional(),
      }))
      .query(async ({ input }) => {
        const rosterKeys = new Set(input.players.map(player => normalizePlayerKey(player.name)));
        const positions = Array.from(new Set(input.players.map(player => player.pos).filter((pos): pos is "QB" | "RB" | "WR" | "TE" | "K" | "DST" => ["QB", "RB", "WR", "TE", "K", "DST"].includes(pos ?? ""))));
        const [leagueNews, ...rankGroups] = await Promise.all([
          getFantasyProsNews(100),
          ...positions.map(position => getFantasyProsRanks(position, 1)),
        ]);
        const playerIds = new Map(rankGroups.flat().map(rank => [normalizePlayerKey(rank.name), rank.playerId]));
        const recentLeagueMatches = leagueNews.filter(item => rosterKeys.has(normalizePlayerKey(item.playerName)));
        const rosterPlayersWithIds = input.players.filter(player => playerIds.has(normalizePlayerKey(player.name)));
        const playerSpecificGroups = await mapWithConcurrency(rosterPlayersWithIds, 4, async player => {
          const news = await getFantasyProsNews(6, playerIds.get(normalizePlayerKey(player.name)));
          return news.map(item => ({ ...item, playerName: item.playerName || player.name }));
        });
        const seen = new Set<number | string>();
        return [...recentLeagueMatches, ...playerSpecificGroups.flat()]
          .filter(item => rosterKeys.has(normalizePlayerKey(item.playerName)))
          .filter(item => {
            const key = item.id || `${item.playerName}-${item.title}-${item.published}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
      }),
    injuries: publicProcedure
      .input(z.object({ year: z.number().int(), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsInjuries(input.year, input.week)),
    ranks: publicProcedure
      .input(z.object({ position: z.enum(["ALL", "QB", "RB", "WR", "TE", "K", "DST", "OP"]), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsRanks(input.position, input.week)),
    projections: publicProcedure
      .input(z.object({ position: z.enum(["QB", "RB", "WR", "TE", "K", "DST", "OP"]), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsProjections(input.position, input.week)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
