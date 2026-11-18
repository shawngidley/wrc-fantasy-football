/** League wide text sent to every opted in owner when a trade is accepted. */
export const TRADE_ALERT_TEXT = "🚨🚨 TRADE ALERT 🚨🚨 A trade has been completed in the WRC!";

export type AlertTeam = { id: string; phone_number: string | null; sms_league_trade_alerts?: boolean | null };

/**
 * Phone numbers to text: every owner with a number, unless they were switched
 * off (sms_league_trade_alerts = false; a missing value counts as on, which is
 * also what the column defaults to), minus anyone in excludeTeamIds (the
 * proposer already gets their own "accepted your proposal" text, so they are
 * not texted twice).
 *
 * De-duplicated by number so two team rows sharing a phone never produce two
 * texts to the same handset.
 */
export function tradeAlertRecipients(teams: readonly AlertTeam[], excludeTeamIds: readonly string[] = []): string[] {
  const skip = new Set(excludeTeamIds);
  const seen = new Set<string>();
  const numbers: string[] = [];
  for (const team of teams) {
    if (skip.has(team.id)) continue;
    if (team.sms_league_trade_alerts === false) continue;
    const number = team.phone_number?.trim();
    if (!number || seen.has(number)) continue;
    seen.add(number);
    numbers.push(number);
  }
  return numbers;
}

/**
 * True only for the error PostgREST returns when sms_league_trade_alerts does
 * not exist yet, i.e. before supabase_league_trade_alerts.sql has been run.
 *
 * Deliberately narrow. Retrying on ANY error would mean a transient failure --
 * a timeout, a blip, anything -- silently re-running the query without the
 * column, and every row would then come back with the opt-out field undefined,
 * which counts as "on". An owner who had switched alerts off would be texted
 * anyway, and nothing would say why. 42703 is Postgres's undefined_column.
 */
export function isMissingAlertColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  return error.code === "42703" || /sms_league_trade_alerts/.test(error.message ?? "");
}

/**
 * The message to surface when saving an owner's league-alert preference
 * fails. Names the migration for the one cause that is a setup step rather
 * than a fault: until supabase_league_trade_alerts.sql has run the column
 * does not exist, so the toggle reads as on (teamSettings falls back to on
 * when it cannot read the column) and then refuses every attempt to switch
 * it off. "Unable to save" alone gives no hint that the fix is a one-line
 * migration.
 */
export function leagueAlertSaveErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  if (isMissingAlertColumnError(error)) {
    return "League trade alerts aren't set up yet — run supabase_league_trade_alerts.sql on the database first.";
  }
  return "Unable to save league trade alert setting.";
}
