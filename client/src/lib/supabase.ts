/**
 * WRC Fantasy Football - Supabase Client
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signInWithPin(teamId: string, pin: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("pin", pin)
    .single();
  if (error || !data) return { success: false as const };
  return { success: true as const, team: data };
}

// ── Session helpers (localStorage) ───────────────────────────────────────────

export function getStoredTeam() {
  const raw = localStorage.getItem("wrc_team");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeTeam(team: Record<string, unknown>) {
  localStorage.setItem("wrc_team", JSON.stringify(team));
}

export function clearTeam() {
  localStorage.removeItem("wrc_team");
}
