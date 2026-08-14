/**
 * useWatchlist — manages a team's personal player watchlist in Supabase.
 * Provides the watchlist set, toggle function, and loading state.
 * Watchlist is keyed by player_name (lowercase) for fast O(1) lookups.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

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
  const watchlistQuery = trpc.league.watchlist.useQuery(undefined, {
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });
  const toggleMutation = trpc.league.toggleWatchlistPlayer.useMutation();

  // Load the session-scoped watchlist on mount.
  useEffect(() => {
    if (!teamId) {
      setWatchlist([]);
      setLoading(false);
      return;
    }
    setLoading(watchlistQuery.isLoading || watchlistQuery.isFetching);
    if (watchlistQuery.data) setWatchlist(watchlistQuery.data as WatchlistPlayer[]);
  }, [teamId, watchlistQuery.data, watchlistQuery.isFetching, watchlistQuery.isLoading]);

  const watchlistNames = useMemo(
    () => new Set(watchlist.map(w => w.player_name.toLowerCase())),
    [watchlist],
  );

  const isWatched = useCallback(
    (playerName: string) => watchlistNames.has(playerName.toLowerCase()),
    [watchlistNames]
  );

  const toggleWatch = useCallback(
    async (player: { name: string; pos: string; nflTeam: string }) => {
      if (!teamId) return;
      const result = await toggleMutation.mutateAsync({
        playerName: player.name,
        pos: player.pos,
        nflTeam: player.nflTeam,
      });
      const lowerName = player.name.toLowerCase();
      if (result.action === "removed") {
        setWatchlist(prev => prev.filter(w => w.player_name.toLowerCase() !== lowerName));
      } else {
        setWatchlist(prev => [result.player as WatchlistPlayer, ...prev]);
      }
    },
    [teamId, toggleMutation]
  );

  return { watchlist, watchlistNames, loading, isWatched, toggleWatch };
}
