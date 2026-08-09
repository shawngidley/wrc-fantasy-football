/**
 * useDraftQueue — private per-owner draft queue backed by Supabase draft_queue table
 */
import { useState, useEffect, useCallback } from "react";
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

export function useDraftQueue(teamId: string | null | undefined, season = 2026) {
  const [queue, setQueue] = useState<DraftQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load queue from Supabase
  const loadQueue = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("draft_queue")
      .select("*")
      .eq("team_id", teamId)
      .eq("season", season)
      .order("rank", { ascending: true });
    if (!error && data) setQueue(data as DraftQueueItem[]);
    setLoading(false);
  }, [teamId, season]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Add player to queue (at the end)
  const addToQueue = useCallback(async (player: { name: string; pos: string; nflTeam?: string }) => {
    if (!teamId) return;
    const maxRank = queue.length > 0 ? Math.max(...queue.map(q => q.rank)) : 0;
    const { data, error } = await supabase
      .from("draft_queue")
      .insert({
        team_id: teamId,
        player_name: player.name,
        player_pos: player.pos,
        player_nfl_team: player.nflTeam ?? null,
        rank: maxRank + 1,
        season,
      })
      .select()
      .single();
    if (!error && data) setQueue(prev => [...prev, data as DraftQueueItem]);
  }, [teamId, season, queue]);

  // Remove player from queue
  const removeFromQueue = useCallback(async (id: number) => {
    await supabase.from("draft_queue").delete().eq("id", id);
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

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

    // Persist both rank updates
    await Promise.all([
      supabase.from("draft_queue").update({ rank: newQueue[idx].rank }).eq("id", newQueue[idx].id),
      supabase.from("draft_queue").update({ rank: newQueue[swapIdx].rank }).eq("id", newQueue[swapIdx].id),
    ]);
  }, [queue]);

  // Check if a player is already in the queue
  const isQueued = useCallback((playerName: string) => {
    return queue.some(q => q.player_name.toLowerCase() === playerName.toLowerCase());
  }, [queue]);

  return { queue, loading, addToQueue, removeFromQueue, moveItem, isQueued, reload: loadQueue };
}
