/**
 * useWatchlist — manages a team's personal player watchlist in Supabase.
 * Provides the watchlist set, toggle function, and loading state.
 * Watchlist is keyed by player_name (lowercase) for fast O(1) lookups.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface WatchlistPlayer {
  player_name: string;
  pos: string;
  nfl_team: string;
  added_at: string;
}

interface UseWatchlistResult {
  watchlist: WatchlistPlayer[];
  watchlistNames: Set<string>;  // lowercase player names for O(1) lookup
  loading: boolean;
  isWatched: (playerName: string) => boolean;
  toggleWatch: (player: { name: string; pos: string; nflTeam: string }) => Promise<void>;
}

export function useWatchlist(teamId: string | null | undefined): UseWatchlistResult {
  const [watchlist, setWatchlist] = useState<WatchlistPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Load watchlist from Supabase on mount
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    supabase
      .from("watchlist")
      .select("player_name,pos,nfl_team,added_at")
      .eq("team_id", teamId)
      .order("added_at", { ascending: false })
      .then(({ data }) => {
        if (data) setWatchlist(data as WatchlistPlayer[]);
        setLoading(false);
      });
  }, [teamId]);

  const watchlistNames = new Set(watchlist.map(w => w.player_name.toLowerCase()));

  const isWatched = useCallback(
    (playerName: string) => watchlistNames.has(playerName.toLowerCase()),
    [watchlistNames]
  );

  const toggleWatch = useCallback(
    async (player: { name: string; pos: string; nflTeam: string }) => {
      if (!teamId) return;
      const lowerName = player.name.toLowerCase();
      const already = watchlistNames.has(lowerName);

      if (already) {
        // Remove from watchlist
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("team_id", teamId)
          .eq("player_name", player.name);
        if (!error) {
          setWatchlist(prev => prev.filter(w => w.player_name.toLowerCase() !== lowerName));
        }
      } else {
        // Add to watchlist
        const newRow: WatchlistPlayer = {
          player_name: player.name,
          pos: player.pos,
          nfl_team: player.nflTeam,
          added_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("watchlist")
          .insert({ team_id: teamId, ...newRow });
        if (!error) {
          setWatchlist(prev => [newRow, ...prev]);
        }
      }
    },
    [teamId, watchlistNames]
  );

  return { watchlist, watchlistNames, loading, isWatched, toggleWatch };
}
