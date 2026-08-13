/**
 * useNFLInjuries — fetches injury designations for all NFL players
 * through the secure server-side FantasyPros API proxy.
 *
 * Returns a map of playerName (lowercase) → injury designation string
 * e.g. "Questionable", "Doubtful", "Out", "IR", "PUP", ""
 *
 * Strategy: fetch all 32 NFL teams in parallel, cache in sessionStorage.
 * Refreshes once per day (86400s TTL).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/** Map of lowercase player name → injury designation */
export type InjuryMap = Record<string, string>;

interface UseNFLInjuriesResult {
  injuries: InjuryMap;
  loading: boolean;
}

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = 1;

/** Get a color for an injury designation badge */
export function getInjuryColor(designation: string): { bg: string; text: string; border: string } | null {
  const d = designation?.toLowerCase();
  if (!d) return null;
  if (d === "out" || d === "ir" || d === "pup" || d === "dnr") {
    return { bg: "oklch(0.95 0.06 25)", text: "oklch(0.42 0.22 25)", border: "oklch(0.82 0.14 25)" };
  }
  if (d === "doubtful") {
    return { bg: "oklch(0.95 0.06 40)", text: "oklch(0.45 0.2 40)", border: "oklch(0.82 0.12 40)" };
  }
  if (d === "questionable") {
    return { bg: "oklch(0.96 0.06 85)", text: "oklch(0.45 0.18 85)", border: "oklch(0.82 0.12 85)" };
  }
  // Limited, Probable, etc.
  return { bg: "oklch(0.95 0.04 150)", text: "oklch(0.42 0.14 150)", border: "oklch(0.80 0.1 150)" };
}

/** Abbreviated designation label for badges */
export function getInjuryLabel(designation: string): string {
  const d = designation?.toUpperCase();
  if (d === "QUESTIONABLE") return "Q";
  if (d === "DOUBTFUL") return "D";
  if (d === "OUT") return "OUT";
  if (d === "INJURED RESERVE" || d === "IR") return "IR";
  if (d === "PUP") return "PUP";
  if (d === "DNR") return "DNR";
  return d;
}

export function useNFLInjuries(): UseNFLInjuriesResult {
  const query = trpc.fantasyPros.injuries.useQuery(
    { year: CURRENT_SEASON, week: CURRENT_WEEK },
    { staleTime: 20 * 60_000, refetchOnWindowFocus: false },
  );
  const injuries = useMemo<InjuryMap>(() => Object.fromEntries(
    (query.data ?? []).filter(item => item.name && item.status).map(item => [item.name.toLowerCase(), item.status]),
  ), [query.data]);

  return { injuries, loading: query.isLoading };
}

/**
 * Look up a player's injury designation.
 * Returns empty string if no injury.
 */
export function getInjuryDesignation(injuries: InjuryMap, playerName: string): string {
  return injuries[playerName.toLowerCase()] ?? "";
}
