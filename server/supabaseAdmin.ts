import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Lazy so importing this module (e.g. transitively, in a unit test that never
// touches Supabase) doesn't require SUPABASE_SERVICE_ROLE_KEY to be set —
// only actually calling a method on it does.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
