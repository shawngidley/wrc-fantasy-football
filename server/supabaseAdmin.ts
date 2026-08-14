import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

export const supabaseAdmin = createClient(SUPABASE_URL, getServiceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
