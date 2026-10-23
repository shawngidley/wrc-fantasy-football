-- Atomic lineup replace for the Lineup page save and autosave.
--
-- The server used to delete a team's lineup for the week and then insert the
-- new rows as two separate calls. If the insert failed after the delete, the
-- team was left with no lineup for the week. This does both in one
-- transaction, so a failed save leaves the previous lineup untouched.
--
-- Run once in the Supabase SQL editor. Safe to deploy the API first: until
-- this exists the server falls back to the old delete then insert.

create or replace function public.replace_lineup(
  p_team_id text,
  p_week integer,
  p_season integer,
  p_rows jsonb
) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  delete from public.lineups
  where team_id = p_team_id and week = p_week and season = p_season;

  insert into public.lineups (team_id, week, season, slot, player_id, player_name, is_bench)
  select p_team_id, p_week, p_season, r.slot, r.player_id, r.player_name, r.is_bench
  from jsonb_to_recordset(p_rows) as r(slot text, player_id text, player_name text, is_bench boolean);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- The server calls this with the service role key only. Supabase exposes
-- functions to the public API by default, so lock it down.
revoke all on function public.replace_lineup(text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.replace_lineup(text, integer, integer, jsonb) to service_role;
