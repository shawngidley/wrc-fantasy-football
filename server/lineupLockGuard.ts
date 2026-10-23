import { normalizePlayerName } from "../shared/playerNameMatch";
import type { RosterPlayerWithId, SavedLineupRow } from "../shared/effectiveStarters";
import { findMovedLineupPlayers, type LineupMoveRow } from "../shared/lineupMoves";
import { resolveLineupsForWeek } from "./lineupResolution";
import { hasPlayerTeamGameStarted } from "./nflWeekKickoffCheck";
import { supabaseAdmin } from "./supabaseAdmin";

export interface LineupLockDeps {
  loadRoster(teamId: string): Promise<RosterPlayerWithId[]>;
  loadSavedLineup(week: number, season: number, teamId: string): Promise<SavedLineupRow[]>;
  hasGameStarted(nflTeam: string, week: number, season: number): Promise<boolean>;
}

const defaultDeps: LineupLockDeps = {
  async loadRoster(teamId) {
    const { data, error } = await supabaseAdmin.from("players").select("id, name, position, nfl_team, team_id").eq("team_id", teamId);
    if (error) throw new Error("Unable to load your roster.");
    return (data ?? []) as RosterPlayerWithId[];
  },
  loadSavedLineup: (week, season, teamId) => resolveLineupsForWeek(week, season, teamId),
  hasGameStarted: hasPlayerTeamGameStarted,
};

/**
 * Server side kickoff lock for a lineup save. The Lineup page already blocks
 * moving a player whose game has started; this makes the server enforce it too,
 * so a stale page or a direct call can't swap a locked player in or out.
 *
 * Only players the save actually MOVES are checked, compared with the SAVED
 * lineup the team is on now (carry-forward included) -- the same rows the
 * Lineup page was handed. Re-sending an unchanged lineup (a retry, an autosave
 * that matches) always passes, and no kickoff data is needed for it. If a moved
 * player's kickoff can't be verified, the save is refused, the same fail safe
 * the FAAB bid lock uses.
 *
 * Deliberately NOT compared against buildEffectiveStarters: scoring backfills
 * an empty starter slot by best ADP, while the Lineup page fills it with the
 * first eligible player in roster order, so the two can promote different
 * players into the same gap. Treating scoring's pick as "currently starting"
 * would refuse an owner's untouched save with the name of a player their page
 * never showed as a starter, and nothing they could do would clear it. The
 * cost is that a player occupying a slot only by backfill can be benched after
 * his game starts; that is a narrower hole than having no server check at all,
 * and it closes as soon as the owner saves a complete lineup.
 *
 * Callers skip this for the commissioner, who can override locks.
 */
export async function assertLineupMovesAllowed(
  input: { teamId: string; week: number; season: number; rows: readonly LineupMoveRow[] },
  deps: LineupLockDeps = defaultDeps,
): Promise<void> {
  const [roster, saved] = await Promise.all([
    deps.loadRoster(input.teamId),
    deps.loadSavedLineup(input.week, input.season, input.teamId),
  ]);
  const byName = new Map(roster.map(p => [normalizePlayerName(p.name), p]));
  const baseline = saved.flatMap(row => {
    if (row.is_bench) return [];
    const player = byName.get(normalizePlayerName(row.player_name));
    return player ? [{ slot: row.slot, player }] : [];
  });
  const moved = findMovedLineupPlayers(baseline, input.rows, roster);
  if (moved.length === 0) return;

  for (const nflTeam of Array.from(new Set(moved.map(p => p.nfl_team)))) {
    let started: boolean;
    try {
      started = await deps.hasGameStarted(nflTeam, input.week, input.season);
    } catch {
      throw new Error("Couldn't verify kickoff times to save this lineup. Please try again in a minute.");
    }
    if (started) {
      const player = moved.find(p => p.nfl_team === nflTeam)!;
      throw new Error(`${player.name}'s game has already started, so they can't be moved in or out of your lineup this week.`);
    }
  }
}
