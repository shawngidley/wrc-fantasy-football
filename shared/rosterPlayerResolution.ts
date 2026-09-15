import { normalizePlayerName } from "./playerNameMatch";

export type RosterPlayerRow = {
  id?: string;
  name: string;
  position: string;
  nfl_team: string;
  team_id: string;
};

export type LineupEntryForResolution = {
  team_id: string;
  player_id?: string | null;
  player_name: string;
  slot: string;
};

/**
 * Resolves a saved lineup entry to its actual roster player info
 * (position, nflTeam), needed to look up that player's score. This is
 * the single, shared version of a resolution strategy that used to be
 * duplicated across the client (useOwnerMatchupScore.ts, the Standings
 * matchup card) and the server (weeklyResultsFinalize.ts, official
 * weekly scoring) -- confirmed live that the two copies had drifted:
 * the client's name fallback was an exact match only, while the
 * server's didn't handle a player_id at all, and neither combination
 * caught every real mismatch on its own.
 *
 * Tries, in order:
 * 1. player_id, if the lineup entry has one and it matches a current
 *    roster row -- the most reliable when available (not every caller
 *    tracks player_id, so this step is skipped entirely when absent).
 * 2. Name, normalized via normalizePlayerName on both sides -- handles
 *    a generational-suffix mismatch between the lineup's saved name and
 *    the roster's current stored name (confirmed live: "James Cook III"
 *    vs "James Cook", "Kyle Pitts Sr." vs "Kyle Pitts").
 * 3. For a DST slot specifically, team_id + position === "DST" directly
 *    -- since a team can only ever roster one DST, this sidesteps an
 *    entirely different name altogether (confirmed live: a lineup
 *    saved as "LA Rams"/"LA Chargers"/"KC Chiefs" while the roster's
 *    own stored name for that same team was something else again --
 *    not just a suffix difference, or a draft-time identifier that no
 *    longer matches the roster's current row at all).
 *
 * Every one of these mismatches, uncaught, doesn't produce a wrong
 * score -- it silently skips that player from scoring entirely.
 */
export function resolveRosterPlayerForLineupEntry(
  entry: LineupEntryForResolution,
  playerById: Map<string, RosterPlayerRow>,
  playerByNormalizedName: Map<string, RosterPlayerRow>,
  allPlayers: RosterPlayerRow[],
): RosterPlayerRow | undefined {
  const byId = entry.player_id ? playerById.get(entry.player_id) : undefined;
  const byName = byId ?? playerByNormalizedName.get(normalizePlayerName(entry.player_name));
  if (byName) return byName;
  if (entry.slot === "DST") {
    return allPlayers.find(candidate => candidate.team_id === entry.team_id && candidate.position === "DST");
  }
  return undefined;
}
