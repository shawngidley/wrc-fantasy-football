import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, teamProcedure } from "./_core/trpc";
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

const normalizePlayerKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

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
