-- Supabase Postgres equivalents of the two cache tables that previously lived in
-- MySQL via Drizzle (server/db.ts, drizzle/schema.ts). Both are pure, TTL'd caches
-- that self-populate from FantasyPros/Tank01 on the next scheduled run — no
-- historical-data migration is needed.

create table if not exists fantasypros_news_archive (
  id bigint generated always as identity primary key,
  archive_key varchar(128) not null unique,
  source varchar(32) not null default 'FantasyPros',
  source_item_id varchar(64),
  player_id integer,
  player_name varchar(160) not null,
  team varchar(8),
  position varchar(8),
  title text not null,
  description text,
  impact text,
  author varchar(160),
  article_url text,
  published_at timestamptz not null,
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists fantasypros_news_archive_published_at_idx
  on fantasypros_news_archive (published_at);
create index if not exists fantasypros_news_archive_position_published_idx
  on fantasypros_news_archive (position, published_at);

create table if not exists fantasypros_news_archive_config (
  id varchar(64) primary key,
  schedule_cron_task_uid varchar(65),
  retention_days integer not null default 30,
  last_collected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists wrc_season_stats_cache (
  id varchar(64) primary key,
  season integer not null,
  source varchar(96) not null,
  payload text not null,
  schedule_cron_task_uid varchar(65),
  refreshed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table fantasypros_news_archive enable row level security;
alter table fantasypros_news_archive_config enable row level security;
alter table wrc_season_stats_cache enable row level security;
-- No policies: only the server-side service-role client (which bypasses RLS)
-- ever touches these tables, matching every other table in this app.
