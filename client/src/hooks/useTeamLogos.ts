/**
 * useTeamLogos — fetches custom logo_url values from the Supabase teams table.
 * Caches in module-level memory so all TeamLogo instances share one fetch.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Module-level cache so we only fetch once per page load
let cachedLogos: Record<string, string> | null = null;
let fetchPromise: Promise<Record<string, string>> | null = null; // eslint-disable-line

async function fetchLogos(): Promise<Record<string, string>> {
  if (cachedLogos) return cachedLogos;
  if (fetchPromise) return fetchPromise;
  const p = supabase
    .from("teams")
    .select("name, logo_url")
    .then(({ data }) => {
      const map: Record<string, string> = {};
      if (data) {
        for (const row of data as { name: string; logo_url?: string | null }[]) {
          if (row.logo_url) map[row.name] = row.logo_url;
        }
      }
      cachedLogos = map;
      return map;
    });
  fetchPromise = p as Promise<Record<string, string>>;
  return fetchPromise;
}

/** Invalidate the cache (call after a logo upload so the new URL is picked up) */
export function invalidateTeamLogosCache() {
  cachedLogos = null;
  fetchPromise = null;
}

export function useTeamLogos(): Record<string, string> {
  const [logos, setLogos] = useState<Record<string, string>>(() => cachedLogos ?? {});
  useEffect(() => {
    fetchLogos().then(setLogos);
  }, []);
  return logos;
}
