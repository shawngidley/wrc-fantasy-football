import { supabaseAdmin } from "./supabaseAdmin";
import { isProtectionDeadlinePassed } from "../shared/protectionSchedule";

/**
 * Releases all rostered players that were not saved as protections. The update
 * is idempotent: already released players have no team_id and are skipped.
 */
export async function releaseUnprotectedPlayers(now = Date.now()) {
  if (!isProtectionDeadlinePassed(now)) {
    return { released: 0, skipped: "before-deadline" as const };
  }

  const [{ data: protectedRows, error: protectedError }, { data: rosteredPlayers, error: rosteredError }] = await Promise.all([
    supabaseAdmin.from("protections").select("player_id"),
    supabaseAdmin.from("players").select("id").not("team_id", "is", null),
  ]);
  if (protectedError || rosteredError) throw new Error("Unable to identify post-deadline player availability.");

  const protectedIds = new Set((protectedRows ?? []).map(row => row.player_id));
  const releaseIds = (rosteredPlayers ?? []).map(player => player.id).filter(id => !protectedIds.has(id));
  if (!releaseIds.length) return { released: 0, skipped: "already-released" as const };

  const { error } = await supabaseAdmin
    .from("players")
    .update({ team_id: null, acquisition: "FA", draft_round: null })
    .in("id", releaseIds);
  if (error) throw new Error("Unable to release unprotected players into the draft pool.");
  return { released: releaseIds.length, skipped: null };
}
