import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./_core/cookies";

export const WRC_TEAM_SESSION_COOKIE = "wrc_team_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type WrcTeamSession = {
  teamId: string;
  isCommissioner: boolean;
};

function getSigningKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

function readCookie(req: Request, name: string) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const pair = cookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

export async function readWrcTeamSession(req: Request): Promise<WrcTeamSession | null> {
  const token = readCookie(req, WRC_TEAM_SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (typeof payload.teamId !== "string" || typeof payload.isCommissioner !== "boolean") return null;
    return { teamId: payload.teamId, isCommissioner: payload.isCommissioner };
  } catch {
    return null;
  }
}

export async function writeWrcTeamSession(res: Response, req: Request, session: WrcTeamSession) {
  const token = await new SignJWT({ teamId: session.teamId, isCommissioner: session.isCommissioner })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());
  res.cookie(WRC_TEAM_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearWrcTeamSession(res: Response, req: Request) {
  res.clearCookie(WRC_TEAM_SESSION_COOKIE, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}
