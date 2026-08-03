/**
 * WRC Fantasy Football — Draft tables migration
 * Run: node scripts/migrate-draft.mjs
 *
 * Creates draft_state and draft_picks tables via Supabase REST API
 * using the service role key (needed for DDL).
 */

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
// anon key — used for RPC/SQL via the REST endpoint
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

const sql = `
-- draft_state: single-row tracking current draft position
CREATE TABLE IF NOT EXISTS draft_state (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  started         BOOLEAN NOT NULL DEFAULT FALSE,
  paused          BOOLEAN NOT NULL DEFAULT FALSE,
  complete        BOOLEAN NOT NULL DEFAULT FALSE,
  current_round   INTEGER NOT NULL DEFAULT 1,
  current_pick    INTEGER NOT NULL DEFAULT 0,
  timer_seconds   INTEGER NOT NULL DEFAULT 90,
  timer_started_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO draft_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- draft_picks: one row per completed pick
CREATE TABLE IF NOT EXISTS draft_picks (
  id              SERIAL PRIMARY KEY,
  round           INTEGER NOT NULL,
  pick            INTEGER NOT NULL,
  overall         INTEGER NOT NULL,
  team_name       TEXT NOT NULL,
  owner           TEXT NOT NULL,
  player_name     TEXT NOT NULL,
  player_pos      TEXT NOT NULL,
  player_nfl_team TEXT NOT NULL DEFAULT '',
  picked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round, pick)
);

-- RLS
ALTER TABLE draft_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='draft_state' AND policyname='allow_all_draft_state') THEN
    CREATE POLICY "allow_all_draft_state" ON draft_state FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='draft_picks' AND policyname='allow_all_draft_picks') THEN
    CREATE POLICY "allow_all_draft_picks" ON draft_picks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  const text = await res.text();
  console.error("RPC failed:", res.status, text);
  console.log("\nFalling back: printing SQL for manual execution in Supabase SQL editor...\n");
  console.log(sql);
  process.exit(1);
}

console.log("Migration complete.");
