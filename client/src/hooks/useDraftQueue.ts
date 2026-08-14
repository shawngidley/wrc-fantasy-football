/**
 * useDraftQueue — private per-owner draft queue backed by Supabase draft_queue table
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export interface DraftQueueItem {
  id: number;
  team_id: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string | null;
  rank: number;
  season: number;
}

export function useDraftQueue(teamId: string | null | undefined, season = 2026) {
  const [queue, setQueue] = useState<DraftQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const queueQuery = trpc.league.draftQueue.useQuery(
    { season },
    { enabled: Boolean(teamId), staleTime: 30_000 },
  );
  const addMutation = trpc.league.addDraftQueueItem.useMutation();
  const removeMutation = trpc.league.removeDraftQueueItem.useMutation();
  const reorderMutation = trpc.league.reorderDraftQueue.useMutation();

  // Load queue from Supabase
  const loadQueue = useCallback(async () => {
    await queueQuery.refetch();
  }, [queueQuery]);

  useEffect(() => {
    setLoading(queueQuery.isLoading || queueQuery.isFetching);
    if (queueQuery.data) setQueue(queueQuery.data as DraftQueueItem[]);
  }, [queueQuery.data, queueQuery.isFetching, queueQuery.isLoading]);

  // Add player to queue (at the end)
  const addToQueue = useCallback(async (player: { name: string; pos: string; nflTeam?: string }) => {
    if (!teamId) return;
    const data = await addMutation.mutateAsync({
      season,
      playerName: player.name,
      playerPos: player.pos,
      playerNflTeam: player.nflTeam ?? null,
    });
    setQueue(prev => [...prev, data as DraftQueueItem]);
  }, [teamId, season, addMutation]);

  // Remove player from queue
  const removeFromQueue = useCallback(async (id: number) => {
    await removeMutation.mutateAsync({ id, season });
    setQueue(prev => prev.filter(q => q.id !== id));
  }, [removeMutation, season]);

  // Move player up or down in rank
  const moveItem = useCallback(async (id: number, direction: "up" | "down") => {
    const idx = queue.findIndex(q => q.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= queue.length) return;

    const newQueue = [...queue];
    const tempRank = newQueue[idx].rank;
    newQueue[idx] = { ...newQueue[idx], rank: newQueue[swapIdx].rank };
    newQueue[swapIdx] = { ...newQueue[swapIdx], rank: tempRank };
    newQueue.sort((a, b) => a.rank - b.rank);
    setQueue(newQueue);

    await reorderMutation.mutateAsync({ season, orderedIds: newQueue.map(item => item.id) });
  }, [queue, reorderMutation, season]);

  // Check if a player is already in the queue
  const isQueued = useCallback((playerName: string) => {
    return queue.some(q => q.player_name.toLowerCase() === playerName.toLowerCase());
  }, [queue]);

  return { queue, loading, addToQueue, removeFromQueue, moveItem, isQueued, reload: loadQueue };
}
