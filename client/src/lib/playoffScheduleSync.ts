/**
 * Keeps SCHEDULE_2026 in step with the real playoff games.
 *
 * The playoff games are not known until the regular season ends, so the
 * schedule file has "TBD" for Weeks 15 to 17. Once the server creates the
 * games (as weekly_results rows), this reads them and fills them into
 * SCHEDULE_2026, so every page that reads the schedule shows the real
 * matchups. Pages re-render when that happens by calling
 * usePlayoffScheduleVersion().
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, applyPlayoffMatchups } from "@/lib/scheduleData2026";
import { REGULAR_SEASON_WEEKS } from "@/lib/playoffPicture";

let version = 0;
let started = false;
const listeners = new Set<() => void>();

async function loadPlayoffGames() {
  const { data, error } = await supabase
    .from("weekly_results")
    .select("week, home_owner, away_owner")
    .eq("season", 2026)
    .gt("week", REGULAR_SEASON_WEEKS)
    .order("id", { ascending: true });
  if (error || !data) return;
  if (applyPlayoffMatchups(SCHEDULE_2026, data)) {
    version += 1;
    listeners.forEach(listener => listener());
  }
}

/** Starts loading once, then refreshes when a game is added or the tab comes back into view. */
export function startPlayoffScheduleSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  void loadPlayoffGames();
  supabase.channel("playoff-schedule")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "weekly_results" }, () => { void loadPlayoffGames(); })
    .subscribe();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadPlayoffGames();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Changes whenever the playoff games change, so a component can re-render or reload. */
export function usePlayoffScheduleVersion(): number {
  useEffect(() => { startPlayoffScheduleSync(); }, []);
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
