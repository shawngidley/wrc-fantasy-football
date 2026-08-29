/**
 * useDraftQueue — private per-owner draft queue backed by Supabase draft_queue table
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

export interface DraftQueueItem {
  id: number;
  team_id: string;
  player_name: string;
  player_pos: string;
  player_nfl_team: string | null;
  rank: number;
  season: number;
}

export function appendDraftQueueItem(previous: DraftQueueItem[] | undefined, item: DraftQueueItem): DraftQueueItem[] {
  return [...(previous ?? []), item];
}

export function removeDraftQueueItem(previous: DraftQueueItem[] | undefined, id: number): DraftQueueItem[] {
  return (previous ?? []).filter(item => item.id !== id);
}

export function findDraftQueueItemByPlayerName(items: readonly DraftQueueItem[], playerName: string): DraftQueueItem | undefined {
  return items.find(item => item.player_name.toLowerCase() === playerName.toLowerCase());
}

export function useDraftQueue(teamId: string | null | undefined, season = 2026) {
  const [queue, setQueue] = useState<DraftQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();
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

  // Live sync: refetch this team's queue whenever draft_queue changes at
  // all, not just when this team's own add/remove/reorder actions run.
  // Needed specifically because a drafted player gets removed from EVERY
  // team's queue as part of makeDraftPick, regardless of which team made
  // the pick -- without this, only the drafting owner's own browser saw
  // the change (via the explicit reload() call after their own pick), and
  // every other owner's queue stayed stale until they manually refreshed.
  useEffect(() => {
    if (!teamId) return;
    const channel = supabase
      .channel("draft-queue-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_queue" }, () => {
        queueQuery.refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queueQuery]);

  // Add player to queue (at the end)
  const addToQueue = useCallback(async (player: { name: string; pos: string; nflTeam?: string }) => {
    if (!teamId) return;
    const data = await addMutation.mutateAsync({
      season,
      playerName: player.name,
      playerPos: player.pos,
      playerNflTeam: player.nflTeam ?? null,
    });
    const queuedItem = data as DraftQueueItem;
    setQueue(prev => [...prev, queuedItem]);
    utils.league.draftQueue.setData({ season }, previous => appendDraftQueueItem(previous, queuedItem));
  }, [teamId, season, addMutation, utils.league.draftQueue]);

  // Remove player from queue
  const removeFromQueue = useCallback(async (id: number) => {
    await removeMutation.mutateAsync({ id, season });
    setQueue(prev => prev.filter(q => q.id !== id));
    utils.league.draftQueue.setData({ season }, previous => removeDraftQueueItem(previous, id));
  }, [removeMutation, season, utils.league.draftQueue]);

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
    utils.league.draftQueue.setData({ season }, newQueue);
  }, [queue, reorderMutation, season, utils.league.draftQueue]);

  // Check if a player is already in the queue
  const isQueued = useCallback((playerName: string) => {
    return Boolean(findDraftQueueItemByPlayerName(queue, playerName));
  }, [queue]);

  return { queue, loading, addToQueue, removeFromQueue, moveItem, isQueued, reload: loadQueue };
}
