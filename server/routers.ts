import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { clearLeagueSessionCookie, issueLeagueSession, readLeagueSession, setLeagueSessionCookie } from "./leagueSession";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  getFantasyProsInjuries,
  getFantasyProsNews,
  getFantasyProsProjections,
  getFantasyProsRanks,
} from "./fantasypros";

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
    teams: publicProcedure.query(async () => {
      const { data, error } = await getSupabaseAdmin().from("teams").select("id, name, owner, division, faab, wins, losses, ties, points_for, points_against, is_commissioner").order("name");
      if (error) throw new Error("Unable to load league teams");
      return data;
    }),
    login: publicProcedure.input(z.object({ teamId: z.string().uuid(), pin: z.string().min(1).max(32) })).mutation(async ({ input, ctx }) => {
      const { data, error } = await getSupabaseAdmin().rpc("verify_wrc_team_pin", { p_team_id: input.teamId, p_pin: input.pin });
      const team = data?.[0];
      if (error || !team) throw new Error("Incorrect PIN");
      setLeagueSessionCookie(ctx, await issueLeagueSession(team.id, team.is_commissioner === true));
      return team;
    }),
    session: publicProcedure.query(async ({ ctx }) => readLeagueSession(ctx)),
    logout: publicProcedure.mutation(({ ctx }) => { clearLeagueSessionCookie(ctx); return { success: true } as const; }),
  }),

  lineups: router({
    save: publicProcedure.input(z.object({ teamId: z.string(), week: z.number().int(), season: z.number().int(), rows: z.array(z.object({ slot: z.string(), player_id: z.string(), player_name: z.string(), is_bench: z.boolean() })) })).mutation(async ({ input, ctx }) => {
      const session = await readLeagueSession(ctx);
      if (!session || session.teamId !== input.teamId) throw new Error("Not authorized to save this lineup");
      const admin = getSupabaseAdmin();
      const { error: deleted } = await admin.from("lineups").delete().eq("team_id", input.teamId).eq("week", input.week).eq("season", input.season);
      if (deleted) throw new Error("Unable to replace lineup");
      const { error: inserted } = await admin.from("lineups").insert(input.rows.map(row => ({ ...row, team_id: input.teamId, week: input.week, season: input.season })));
      if (inserted) throw new Error("Unable to save lineup");
      return { success: true } as const;
    }),
  }),

  fantasyPros: router({
    news: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(({ input }) => getFantasyProsNews(input?.limit ?? 50)),
    injuries: publicProcedure
      .input(z.object({ year: z.number().int(), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsInjuries(input.year, input.week)),
    ranks: publicProcedure
      .input(z.object({ position: z.enum(["QB", "RB", "WR", "TE", "K", "DST", "OP"]), week: z.number().int().min(0).max(18) }))
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
