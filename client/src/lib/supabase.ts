/**
 * WRC Fantasy Football - Supabase Client
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
