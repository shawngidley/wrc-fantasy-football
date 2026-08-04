/**
 * WRC Fantasy Football — FAAB bids table migration
 * Run: node scripts/migrate-faab.mjs
 */
const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

const sql = `
CREATE TABLE IF NOT EXISTS faab_bids (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week             INTEGER NOT NULL DEFAULT 1,
  team_id          TEXT NOT NULL,
  team_name        TEXT NOT NULL,
  player_name      TEXT NOT NULL,
  player_id        TEXT,
  player_pos       TEXT,
  player_nfl_team  TEXT,
  bid_amount       INTEGER NOT NULL DEFAULT 0,
  drop_player_name TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS faab_bids_week_idx ON faab_bids (week);
CREATE INDEX IF NOT EXISTS faab_bids_status_idx ON faab_bids (status);
CREATE INDEX IF NOT EXISTS faab_bids_team_idx ON faab_bids (team_id);
ALTER TABLE faab_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faab_bids' AND policyname='allow_all_faab_bids') THEN
    CREATE POLICY "allow_all_faab_bids" ON faab_bids FOR ALL TO anon USING (true) WITH CHECK (true);
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
  console.log("\nRun this SQL manually in Supabase SQL Editor:\n");
  console.log(sql);
  process.exit(1);
}

console.log("✅ faab_bids table created successfully.");

// Verify
const check = await fetch(`${SUPABASE_URL}/rest/v1/faab_bids?limit=1`, {
  headers: {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  },
});
if (check.status === 200) {
  console.log("✅ Table verified — ready for FAAB bids.");
} else {
  console.log("⚠️  Table check returned:", check.status);
}
