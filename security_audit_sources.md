# Supabase Security Audit Sources

## Official guidance

Supabase documents that Row Level Security should be enabled for all tables stored in exposed schemas, including the default `public` schema. It also explains that browser access should use RLS policies and that service-role keys must never be exposed to users.

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api

## WRC audit finding

On 2026-08-11, anonymous REST requests returned HTTP 200 for the `teams`, `lineups`, `faab_bids`, `draft_queue`, and `trade_proposals` tables. The current PIN login query selects every team PIN into the browser, so the PINs cannot be treated as private credentials.
