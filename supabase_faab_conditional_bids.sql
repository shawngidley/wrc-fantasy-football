-- Conditional (ranked-group) FAAB bidding.
--
-- Links an owner's bids into a group that wins at most `group_max_wins`
-- players (v1: always 1), in `group_rank` preference order (rank 1 = most
-- wanted). Standalone bids leave all three columns null and behave exactly
-- as before. Additive and safe to run any time; only the server-side
-- service-role client writes these, so no RLS policy is needed.

alter table faab_bids add column if not exists group_id       text;
alter table faab_bids add column if not exists group_rank     integer;
alter table faab_bids add column if not exists group_max_wins integer;

-- The award groups a team's bids by group_id, so index it.
create index if not exists faab_bids_group_id_idx on faab_bids (group_id);

-- The award introduces a new bid status, 'skipped', for a bid the group
-- passed over because it already won a higher-ranked pick (distinct from
-- 'lost', which means outbid). status is a free-text column today, so no
-- change is needed here -- BUT if a CHECK constraint or enum is ever added
-- to faab_bids.status, it must include 'skipped' alongside
-- pending / won / lost / cancelled.
