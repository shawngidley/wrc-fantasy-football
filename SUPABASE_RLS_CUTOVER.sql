-- WRC Fantasy Football — Supabase RLS cutover
-- Run this script in the Supabase SQL Editor for aquroadkdiltzsvahuff.
-- Do NOT run it through the Manus database console: that console targets TiDB,
-- while this project database and this script use PostgreSQL / Supabase RLS.
--
-- The application now uses server-side service-role procedures for all writes.
-- These policies grant the browser only direct SELECT access to intentionally
-- public league data. Every other public-schema table has RLS enabled with no
-- anon/authenticated policy, which denies direct API access.

begin;

-- Configure only tables that exist in this project. This lets the transaction
-- succeed if a non-essential table (for example, an archived-news table) is not
-- present in the deployed Supabase schema.
do $$
declare
  table_name text;
  policy_row record;
  all_tables text[] := array[
    'teams', 'players', 'weekly_results', 'draft_picks', 'lineups',
    'faab_bids', 'protections', 'watchlist', 'money_owed', 'gow_history',
    'earnings', 'team_standings', 'roster_moves', 'trade_proposals',
    'traded_picks', 'draft_queue', 'draft_state', 'fp_news_archive'
  ];
  public_read_tables text[] := array[
    'players', 'weekly_results', 'draft_picks', 'lineups', 'money_owed',
    'gow_history', 'earnings', 'team_standings', 'roster_moves',
    'traded_picks', 'draft_state'
  ];
begin
  foreach table_name in array all_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      -- Application roles lose all direct writes. service_role remains untouched.
      execute format('revoke insert, update, delete on table public.%I from anon, authenticated', table_name);
      execute format('alter table public.%I enable row level security', table_name);
      -- Remove every prior policy. A legacy broad policy would otherwise keep
      -- direct browser writes possible after RLS is enabled.
      for policy_row in
        select policyname from pg_policies where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
    end if;
  end loop;
  foreach table_name in array public_read_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'wrc_public_read_' || table_name, table_name);
    end if;
  end loop;
end $$;

-- Direct browser access is intentionally denied for: teams, faab_bids,
-- protections, watchlist, trade_proposals, draft_queue, and fp_news_archive.
-- Server procedures use service_role and continue to operate.

-- PIN verification is exclusively server-side.
revoke execute on function public.verify_wrc_team_pin(text, text) from anon, authenticated;
grant execute on function public.verify_wrc_team_pin(text, text) to service_role;

commit;

-- Post-cutover verification queries. Expected results:
-- 1. Every listed *existing* table has rowsecurity = true.
-- 2. Only the eleven public-read policies appear.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'teams', 'players', 'weekly_results', 'draft_picks', 'lineups',
    'faab_bids', 'protections', 'watchlist', 'money_owed', 'gow_history',
    'earnings', 'team_standings', 'roster_moves', 'trade_proposals',
    'traded_picks', 'draft_queue', 'draft_state', 'fp_news_archive'
  )
order by tablename;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and policyname like 'wrc_public_read_%'
order by tablename, policyname;
