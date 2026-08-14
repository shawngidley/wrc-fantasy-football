import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { type NFLMatchupMap } from "@/hooks/useNFLMatchups";

function isLastGameFinal(matchupMap: NFLMatchupMap): boolean {
  const now = Date.now();
  const latestKickoff = Object.values(matchupMap).reduce((latest, matchup) => {
    if (!matchup.gameDate || !matchup.gameTime) return latest;
    const parts = matchup.gameTime.match(/(\d+):(\d+)([ap])/i);
    if (!parts) return latest;
    let hour = Number(parts[1]);
    if (parts[3].toLowerCase() === "p" && hour !== 12) hour += 12;
    if (parts[3].toLowerCase() === "a" && hour === 12) hour = 0;
    const date = matchup.gameDate;
    const kickoff = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${String(hour + 4).padStart(2, "0")}:${parts[2]}:00Z`).getTime();
    return Math.max(latest, kickoff);
  }, 0);
  return latestKickoff > 0 && now > latestKickoff + 4 * 60 * 60 * 1000;
}

export function useWeeklyResultsWriter(week: number, season: number, matchupMap: NFLMatchupMap, enabled = true) {
  const [autoWriteStatus, setAutoWriteStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [autoWriteError, setAutoWriteError] = useState<string | null>(null);
  const hasRunRef = useRef(false);
  const finalizeMutation = trpc.league.finalizeWeeklyResultsFromTank.useMutation();

  const writeResults = useCallback(async (targetWeek: number, targetSeason: number) => {
    const cacheKey = `wrc_results_written_${targetSeason}_w${targetWeek}`;
    if (sessionStorage.getItem(cacheKey)) { setAutoWriteStatus("done"); return; }
    setAutoWriteStatus("running");
    setAutoWriteError(null);
    try {
      await finalizeMutation.mutateAsync({ week: targetWeek, season: targetSeason });
      sessionStorage.setItem(cacheKey, "1");
      setAutoWriteStatus("done");
    } catch (error) {
      setAutoWriteError(error instanceof Error ? error.message : "Automatic finalization failed.");
      setAutoWriteStatus("error");
    }
  }, [finalizeMutation]);

  useEffect(() => {
    if (!enabled || hasRunRef.current || !Object.keys(matchupMap).length || !isLastGameFinal(matchupMap)) return;
    hasRunRef.current = true;
    void writeResults(week, season);
  }, [enabled, matchupMap, season, week, writeResults]);

  const forceWriteResults = useCallback(async (targetWeek: number, targetSeason = 2026) => {
    hasRunRef.current = true;
    sessionStorage.removeItem(`wrc_results_written_${targetSeason}_w${targetWeek}`);
    await writeResults(targetWeek, targetSeason);
  }, [writeResults]);

  return { autoWriteStatus, autoWriteError, forceWriteResults };
}
