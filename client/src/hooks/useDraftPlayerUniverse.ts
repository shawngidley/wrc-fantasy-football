/**
 * useDraftPlayerUniverse — the draft pool (names, ADP, ids) plus a live
 * nflTeam/bye override refreshed daily from nflverse's roster data.
 *
 * currentDraftPlayerUniverse2026.ts is a hand-generated, point-in-time
 * snapshot -- it doesn't know about a trade, signing, or release that
 * happens after it was last regenerated (confirmed stale for Kayshon
 * Boutte's trade to Houston: the pool still showed New England a week
 * after the trade). This hook merges that static base with
 * league.nflTeamAssignments (backed by nfl_team_assignments, refreshed
 * daily via /api/scheduled/nfl-team-refresh) so nflTeam and bye stay
 * correct without a manual pool edit or a redeploy.
 *
 * Falls back to the static value for any player with no override row yet
 * (e.g. right after a schema change, before the first refresh has run).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026, type DraftUniversePlayer } from "@shared/draftPlayerUniverse";

export function useDraftPlayerUniverse(): readonly DraftUniversePlayer[] {
  const assignmentsQuery = trpc.league.nflTeamAssignments.useQuery(undefined, {
    staleTime: 60 * 60_000, // an hour is plenty -- this only changes once a day server-side
  });

  return useMemo(() => {
    const rows = assignmentsQuery.data;
    if (!rows || rows.length === 0) return CURRENT_DRAFT_PLAYER_UNIVERSE_2026;

    const overrideByPlayerId = new Map(rows.map(row => [row.sourcePlayerId, row]));
    return CURRENT_DRAFT_PLAYER_UNIVERSE_2026.map(player => {
      if (!player.sourcePlayerId) return player;
      const override = overrideByPlayerId.get(player.sourcePlayerId);
      if (!override || override.nflTeam === player.nflTeam) return player;
      return { ...player, nflTeam: override.nflTeam, bye: override.byeWeek ?? player.bye };
    });
  }, [assignmentsQuery.data]);
}
