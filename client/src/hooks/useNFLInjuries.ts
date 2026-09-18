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
import { getLineupDefaultWeek } from "@/lib/scheduleData2026";
import { normalizePlayerName } from "@shared/playerNameMatch";

/** Map of normalized player name → injury designation */
export type InjuryMap = Record<string, string>;

interface UseNFLInjuriesResult {
  injuries: InjuryMap;
  loading: boolean;
}

const CURRENT_SEASON = 2026;

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
  if (d === "SUSPENSION" || d === "SUSPENDED") return "SUSP";
  if (d === "PROBABLE") return "P";
  if (d === "LIMITED") return "LTD";
  if (d === "NON FOOTBALL INJURY" || d === "NFI") return "NFI";
  // Any other status: keep it short so the pill stays a pill.
  return d.length <= 4 ? d : d.slice(0, 4);
}

export function useNFLInjuries(): UseNFLInjuriesResult {
  // The injuries endpoint is per-week; use the current planning week, not a
  // hardcoded Week 1, or every badge shows opening-week designations all
  // season. (The Standings injury panel already used the current week, so
  // this was the source of that panel disagreeing with the lineup badges.)
  const week = getLineupDefaultWeek() || 1;
  const query = trpc.fantasyPros.injuries.useQuery(
    { year: CURRENT_SEASON, week },
    { staleTime: 20 * 60_000, refetchOnWindowFocus: false },
  );
  // Key by the shared normalized name (suffix- and alias-aware) so a lookup
  // for "Michael Pittman Jr." finds "Michael Pittman" and vice versa,
  // instead of the old exact-lowercase match that silently missed anyone
  // whose roster spelling differed from the feed's.
  const injuries = useMemo<InjuryMap>(() => Object.fromEntries(
    (query.data ?? []).filter(item => item.name && item.status).map(item => [normalizePlayerName(item.name), item.status]),
  ), [query.data]);

  return { injuries, loading: query.isLoading };
}

/**
 * Look up a player's injury designation. Returns empty string if none.
 * Normalizes the query the same way the map is keyed.
 */
export function getInjuryDesignation(injuries: InjuryMap, playerName: string): string {
  return injuries[normalizePlayerName(playerName)] ?? "";
}
