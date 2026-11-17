-- League wide trade alert texts: on for every owner by default.
-- An owner can be switched off with:
--   update public.teams set sms_league_trade_alerts = false where id = 'team-xxx';
alter table public.teams
  add column if not exists sms_league_trade_alerts boolean not null default true;
