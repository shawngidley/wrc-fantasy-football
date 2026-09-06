/**
 * useNFLGameStatus — live per-team game status (scheduled / in progress /
 * final), derived from ESPN's scoreboard endpoint.
 *
 * Takes the already-fetched NFLMatchupMap (from useNFLMatchups) purely to
 * find which dates actually have games this week -- rather than guessing
 * at a date range (NFL weeks aren't always strictly Thu/Sun/Mon; there are
 * occasional Saturday or international games), this derives the exact set
 * of dates directly from data this app already has.
 */
import { useState, useEffect, useRef } from "react";
import type { NFLMatchupMap } from "./useNFLMatchups";

export interface NFLGameStatus {
  state: "pre" | "in" | "post";
  shortDetail: string; // e.g. "9/13 - 1:00 PM EDT", "8:32 - 3rd Quarter", "Final"
  period: number;
  displayClock: string;
}

/** Map of NFL team abbreviation -> their current game's live status */
export type NFLGameStatusMap = Record<string, NFLGameStatus>;

interface UseNFLGameStatusResult {
  gameStatus: NFLGameStatusMap;
  loading: boolean;
}

const POLL_INTERVAL_MS = 30_000;

function normalizeAbv(abv: string): string {
  const map: Record<string, string> = {
    KAN: "KC", TAM: "TB", ARZ: "ARI", AZ: "ARI", JAX: "JAC", WAS: "WSH", WSN: "WSH", OAK: "LV", LA: "LAR",
  };
  return map[abv?.toUpperCase()] ?? abv?.toUpperCase();
}

export function useNFLGameStatus(matchupMap: NFLMatchupMap): UseNFLGameStatusResult {
  const [gameStatus, setGameStatus] = useState<NFLGameStatusMap>({});
  const [loading, setLoading] = useState(true);
  const latestStatusRef = useRef<NFLGameStatusMap>({});

  // Derive the unique set of game dates from the matchup map, rather than
  // computing them independently -- avoids a second, possibly-diverging
  // notion of "which dates are game days this week."
  const gameDates = Array.from(new Set(Object.values(matchupMap).map(m => m.gameDate))).sort();
  const gameDatesKey = gameDates.join(",");

  useEffect(() => {
    if (!gameDates.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function fetchStatus() {
      try {
        const map: NFLGameStatusMap = {};
        await Promise.all(gameDates.map(async date => {
          const res = await fetch(`/api/espn/scoreboard?dates=${date}`);
          if (!res.ok) return;
          const data = await res.json() as {
            events?: Array<{
              competitions?: Array<{
                competitors?: Array<{ team?: { abbreviation?: string } }>;
                status?: { type?: { state?: string; shortDetail?: string }; period?: number; displayClock?: string };
              }>;
            }>;
          };
          for (const event of data.events ?? []) {
            const competition = event.competitions?.[0];
            const status = competition?.status;
            if (!status?.type?.state) continue;
            for (const competitor of competition?.competitors ?? []) {
              const abv = normalizeAbv(competitor.team?.abbreviation ?? "");
              if (!abv) continue;
              map[abv] = {
                state: status.type.state as "pre" | "in" | "post",
                shortDetail: status.type.shortDetail ?? "",
                period: status.period ?? 0,
                displayClock: status.displayClock ?? "",
              };
            }
          }
        }));
        if (!cancelled) {
          latestStatusRef.current = map;
          setGameStatus(map);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    // Only keep polling while at least one tracked game might still be
    // live -- once everything's final there's nothing left to update.
    // Uses the ref (not the gameStatus state variable) since this
    // callback is set up once and would otherwise always see the stale,
    // empty state captured at mount time.
    intervalId = setInterval(() => {
      const current = latestStatusRef.current;
      const stillActive = Object.keys(current).length === 0 || Object.values(current).some(g => g.state !== "post");
      if (stillActive) fetchStatus();
      else if (intervalId) clearInterval(intervalId);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameDatesKey]);

  return { gameStatus, loading };
}
