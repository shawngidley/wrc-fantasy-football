import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { readWrcTeamSession } from "../wrcTeamSession";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireWrcTeam = t.middleware(async ({ ctx, next }) => {
  const teamSession = await readWrcTeamSession(ctx.req);
  if (!teamSession) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in with your league team." });
  return next({ ctx: { ...ctx, teamSession } });
});

export const teamProcedure = t.procedure.use(requireWrcTeam);

export const commissionerProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const teamSession = await readWrcTeamSession(ctx.req);
    if (!teamSession?.isCommissioner) throw new TRPCError({ code: "FORBIDDEN", message: "Commissioner access is required." });
    return next({ ctx: { ...ctx, teamSession } });
  }),
);
