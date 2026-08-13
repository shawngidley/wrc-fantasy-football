import { SignJWT, jwtVerify } from "jose";
import type { Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";
import type { TrpcContext } from "./_core/context";

export const LEAGUE_SESSION_COOKIE = "wrc_league_session";
const encoder = new TextEncoder();
const sessionKey = () => encoder.encode(process.env.JWT_SECRET || "wrc-development-session-key");

export type LeagueSession = { teamId: string; commissioner: boolean };

export async function issueLeagueSession(teamId: string, commissioner: boolean) {
  return new SignJWT({ teamId, commissioner }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(sessionKey());
}

export async function readLeagueSession(ctx: TrpcContext): Promise<LeagueSession | null> {
  const token = ctx.req.cookies?.[LEAGUE_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (typeof payload.teamId !== "string") return null;
    return { teamId: payload.teamId, commissioner: payload.commissioner === true };
  } catch { return null; }
}

export function setLeagueSessionCookie(ctx: TrpcContext, token: string) {
  ctx.res.cookie(LEAGUE_SESSION_COOKIE, token, { ...getSessionCookieOptions(ctx.req), maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function clearLeagueSessionCookie(ctx: TrpcContext) {
  ctx.res.clearCookie(LEAGUE_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
}
