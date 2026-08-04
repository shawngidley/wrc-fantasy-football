import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await sb.from("players").select("*").limit(5);
if (error) {
  console.error("Error:", error.message);
} else {
  console.log("Row count:", data.length);
  if (data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
    console.log("Sample row:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("Table is empty — need to check column names via a different method");
  }
}
