import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabaseAdmin";

export type PublicLeagueTeam = {
  id: string;
  name: string;
  owner: string;
  division: string;
  faab: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  is_commissioner: boolean;
};

const PUBLIC_TEAM_COLUMNS = "id, name, owner, division, faab, wins, losses, ties, points_for, points_against, is_commissioner";

export function redactLeagueTeam(team: Record<string, unknown>): PublicLeagueTeam {
  return {
    id: String(team.id),
    name: String(team.name ?? ""),
    owner: String(team.owner ?? ""),
    division: String(team.division ?? ""),
    faab: Number(team.faab ?? 0),
    wins: Number(team.wins ?? 0),
    losses: Number(team.losses ?? 0),
    ties: Number(team.ties ?? 0),
    points_for: Number(team.points_for ?? 0),
    points_against: Number(team.points_against ?? 0),
    is_commissioner: Boolean(team.is_commissioner),
  };
}

export async function listPublicLeagueTeams() {
  const { data, error } = await supabaseAdmin.from("teams").select(PUBLIC_TEAM_COLUMNS).order("name");
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to load teams" });
  return (data ?? []).map((row: Record<string, unknown>) => redactLeagueTeam(row));
}

export async function getPublicLeagueTeam(teamId: string) {
  const { data, error } = await supabaseAdmin.from("teams").select(PUBLIC_TEAM_COLUMNS).eq("id", teamId).maybeSingle();
  if (error || !data) return null;
  return redactLeagueTeam(data);
}

export async function verifyLeagueTeamPin(teamId: string, pin: string) {
  const { data, error } = await supabaseAdmin.rpc("verify_wrc_team_pin", {
    p_team_id: teamId,
    p_pin: pin,
  });
  if (error || !data) return null;
  return getPublicLeagueTeam(teamId);
}
