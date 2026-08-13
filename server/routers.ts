import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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

  fantasyPros: router({
    news: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), fpid: z.number().int().positive().optional() }).optional())
      .query(({ input }) => getFantasyProsNews(input?.limit ?? 50, input?.fpid)),
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
