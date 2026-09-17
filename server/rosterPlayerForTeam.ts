import { supabaseAdmin } from "./supabaseAdmin";
import { normalizePlayerName } from "../shared/playerNameMatch";

export interface PlayersRow {
  id: string;
  team_id: string | null;
  name: string;
  dropped_at: string | null;
}

/**
 * Deterministic players.id for a newly rostered free agent, matching the
 * convention the open-waiver add path has always used
 * (e.g. "keith-devaughn-vele").
 */
export function makePlayerId(teamId: string, playerName: string): string {
  const teamSlug = teamId.replace(/^team-/, "");
  const nameSlug = playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${teamSlug}-${nameSlug}`;
}

/**
 * Finds the players row for a name using the league-wide normalizer, so
 * "TB Buccaneers" finds "Tampa Bay Buccaneers", "Deebo Samuel Sr." finds
 * "Deebo Samuel", and a stray line break or double space in a stored name
 * doesn't cause a miss. Only rows already held in `rows` are searched, so
 * callers fetch once and reuse across a batch.
 */
export function findPlayerRowByName(rows: PlayersRow[], name: string): PlayersRow | null {
  const target = normalizePlayerName(name);
  return rows.find(row => normalizePlayerName(row.name) === target) ?? null;
}

export async function loadPlayerRows(): Promise<PlayersRow[]> {
  const { data, error } = await supabaseAdmin.from("players").select("id, team_id, name, dropped_at");
  if (error) throw new Error(`Unable to load players: ${error.message}`);
  return (data ?? []) as PlayersRow[];
}

/**
 * Puts a won/added free agent onto a team's roster in the players table,
 * creating the row if the player has never been rostered in WRC before.
 *
 * Why this exists: the FAAB award previously did
 *   UPDATE players SET team_id = ... WHERE name = <bid's player_name>
 * which silently matched zero rows for anyone with no players row (only
 * drafted or previously rostered players have one; the free agent list
 * comes from the static NFL player file) and for any DST whose stored
 * name differed from the bid's ("Tampa Bay Buccaneers" vs "TB Buccaneers").
 * The winner was charged and their drop processed, but the player never
 * landed on the roster. Sep 17, 2026: Vele, Deebo Samuel and the
 * Buccaneers all hit this.
 *
 * Returns the players.id now holding the player.
 */
export async function rosterPlayerForTeam(
  rows: PlayersRow[],
  teamId: string,
  player: { name: string; position: string; nflTeam: string },
  acquisition = "FA",
): Promise<string> {
  const existing = findPlayerRowByName(rows, player.name);
  if (existing) {
    if (existing.team_id === teamId) return existing.id;
    if (existing.team_id) throw new Error(`${player.name} is already on another WRC roster.`);
    const { data: claimed, error } = await supabaseAdmin
      .from("players")
      .update({ team_id: teamId, acquisition })
      .eq("id", existing.id)
      .is("team_id", null)
      .select("id");
    if (error) throw new Error(`Unable to add ${player.name} to the roster: ${error.message}`);
    if (!claimed || claimed.length === 0) throw new Error(`${player.name} was just taken by another team.`);
    existing.team_id = teamId;
    return existing.id;
  }

  const id = makePlayerId(teamId, player.name);
  const { error } = await supabaseAdmin.from("players").insert({
    id,
    team_id: teamId,
    name: player.name,
    position: player.position,
    nfl_team: player.nflTeam,
    acquisition,
  });
  if (error) throw new Error(`Unable to add ${player.name} to the roster: ${error.message}`);
  rows.push({ id, team_id: teamId, name: player.name, dropped_at: null });
  return id;
}
