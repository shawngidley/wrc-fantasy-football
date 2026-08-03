import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://aquroadkdiltzsvahuff.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4"
);

const { data: d1, error: e1 } = await sb.from("draft_state").select("id").limit(1);
console.log("draft_state exists:", e1 ? "NO - " + e1.message : "YES", d1);

const { data: d2, error: e2 } = await sb.from("draft_picks").select("id").limit(1);
console.log("draft_picks exists:", e2 ? "NO - " + e2.message : "YES", d2);
