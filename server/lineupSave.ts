import { supabaseAdmin } from "./supabaseAdmin";

export type LineupSaveRow = {
  slot: string;
  player_id: string;
  player_name: string;
  is_bench: boolean;
};

type RpcError = { code?: string; message?: string } | null;
type SaveClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError }>;
  from: (table: string) => any;
};

// The function is missing until supabase_replace_lineup.sql has been run.
// PostgREST reports that as PGRST202 (or Postgres 42883).
//
// The message test deliberately requires the word "function": a bare
// /does not exist/ also matches "column ... does not exist" and "relation
// ... does not exist", and falling back on one of those would delete the
// team's lineup and then fail the insert -- the exact missing-lineup failure
// the transaction exists to prevent.
function isMissingFunction(error: NonNullable<RpcError>) {
  return error.code === "PGRST202"
    || error.code === "42883"
    || /could not find the function|function [^]*? does not exist/i.test(error.message ?? "");
}

/**
 * Replaces a team's lineup for a week in one transaction (replace_lineup).
 * If that function has not been created yet, falls back to the old delete
 * then insert so a deploy that lands before the SQL does not break saving.
 * Any other rpc error is thrown as is, with nothing written.
 */
export async function replaceLineupRows(
  teamId: string,
  week: number,
  season: number,
  rows: readonly LineupSaveRow[],
  client: SaveClient = supabaseAdmin as unknown as SaveClient,
) {
  const { error } = await client.rpc("replace_lineup", { p_team_id: teamId, p_week: week, p_season: season, p_rows: rows });
  if (!error) return;
  if (!isMissingFunction(error)) throw new Error("Unable to save lineup");
  console.log(`[lineupSave] replace_lineup is unavailable (${error.code ?? "no code"}: ${error.message ?? ""}) -- falling back to delete+insert. Run supabase_replace_lineup.sql to restore the atomic save.`);

  const { error: deleteError } = await client.from("lineups").delete().eq("team_id", teamId).eq("week", week).eq("season", season);
  if (deleteError) throw new Error("Unable to replace lineup");
  const { error: insertError } = await client.from("lineups").insert(
    rows.map(row => ({ ...row, team_id: teamId, week, season })),
  );
  if (insertError) throw new Error("Unable to save lineup");
}
