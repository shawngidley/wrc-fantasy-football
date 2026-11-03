-- Keith is in the East and Jamie in the Central, not the other way round.
--
-- The client's division lists (client/src/lib/wrcData.ts) had these two
-- swapped. The schedule proves which way round it is: it pairs division mates
-- twice and everyone else once, and the twice-pairs partition cleanly into
-- {Jonas, David R., Jason, Keith}, {Bill, Dan, Scott N., Jamie} and
-- {David S., Greg, Scott M., Shawn}. See client/src/lib/divisions.test.ts,
-- which derives that from SCHEDULE_2026 and asserts the lists match.
--
-- team_standings.division is a SEPARATE copy of the same fact, and it is the
-- one that matters for records: weeklyResultsFinalize and the commissioner's
-- manual score save both compute div_wins/div_losses from it, and the Schedule
-- and Results page derives playoff seeds (the three division winners) from it.
-- So fixing the client alone leaves the standings wrong and makes the app
-- disagree with itself.
--
-- Run the first SELECT, check it shows the swap, then run the UPDATE.

-- 1. What is in the table now.
select team_id, owner, division, div_wins, div_losses
from public.team_standings
order by division, owner;

-- 2. The fix. Idempotent -- running it twice changes nothing the second time.
update public.team_standings set division = 'East'    where owner = 'Keith' and division <> 'East';
update public.team_standings set division = 'Central' where owner = 'Jamie' and division <> 'Central';

-- 3. Confirm: four teams per division, Keith East, Jamie Central.
select division, count(*) as teams, string_agg(owner, ', ' order by owner) as owners
from public.team_standings
group by division
order by division;

-- 4. div_wins/div_losses are still the old numbers. They are recomputed from
-- every finalized week (not incremented), so the next weekly finalize corrects
-- them on its own. To correct them now, re-finalize any already-final week:
--   SUPABASE_SERVICE_ROLE_KEY=... TANK01_API_KEY=... \
--     ./node_modules/.bin/tsx scripts/refinalizeWeek.ts <week> 2026 --run
-- which prints a before/after diff of every standings field.
