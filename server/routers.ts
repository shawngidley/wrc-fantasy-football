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
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";

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

  fantasyPros: router({
    news: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), fpid: z.number().int().positive().optional() }).optional())
      .query(async ({ input }) => {
        const news = await getFantasyProsNews(input?.limit ?? 50, input?.fpid);
        if (input?.fpid != null || news.every(item => item.playerName)) return news;
        const positions = ["QB", "RB", "WR", "TE", "K", "DST"];
        const rankGroups = await Promise.all(positions.map(position => getFantasyProsRanks(position, 1)));
        return attachFantasyProsPlayerNames(news, rankGroups.flat());
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
