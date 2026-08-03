/**
 * WRC Fantasy Football - Supabase Client
 * Replace the URL and anon key with your actual Supabase project credentials
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export async function signInWithPin(franchiseId: string, pin: string) {
  const { data, error } = await supabase
    .from("franchises")
    .select("id, team_name, owner_name, auth_pin, theme_color")
    .eq("id", franchiseId)
    .eq("auth_pin", pin)
    .single();
  if (error || !data) return { success: false };
  return { success: true, franchise: data };
}

export function getStoredFranchise() {
  const raw = localStorage.getItem("wrc_franchise");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeFranchise(franchise: Record<string, unknown>) {
  localStorage.setItem("wrc_franchise", JSON.stringify(franchise));
}

export function clearFranchise() {
  localStorage.removeItem("wrc_franchise");
}
