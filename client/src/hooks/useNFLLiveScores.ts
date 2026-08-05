/**
 * useNFLLiveScores — polls Tank01 getNFLBoxScore for live fantasy points
 * during active game windows.
 *
 * Returns a map of playerName (lowercase) → live WRC fantasy points,
 * and dst:TEAM → live WRC fantasy points for DST.
 *
 * Polling strategy:
 *  - Only polls when at least one game is currently in progress
 *  - Polls every 30 seconds during active windows
 *  - Stops polling when all games are final
 *  - Uses sessionStorage to cache final scores
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { type NFLMatchupMap } from "@/hooks/useNFLMatchups";

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const POLL_INTERVAL_MS = 30_000; // 30 seconds

/** Map of lowercase player name → live WRC fantasy points */
export type LiveScoreMap = Record<string, number>;

interface UseNFLLiveScoresResult {
  liveScores: LiveScoreMap;
  isPolling: boolean;
  lastUpdated: Date | null;
}

// ── Abbreviation normalizer ────────────────────────────────────────────────────
function normalizeAbv(abv: string): string {
  const map: Record<string, string> = {
    kan: "kc", kc: "kc",
    tam: "tb", tb: "tb",
    arz: "ari", ari: "ari",
    jax: "jac", jac: "jac",
    was: "wsh", wsh: "wsh",
  };
  const lo = abv.toLowerCase();
  return (map[lo] ?? lo).toUpperCase();
}

// ── WRC scoring rules (mirrors scoringEngine.ts) ──────────────────────────────
function calcWRCLive(stats: Record<string, unknown>, pos: string): number {
  let pts = 0;
  const n = (v: unknown) => parseFloat((v as string) ?? "0") || 0;

  // Passing
  const pass = (stats.Passing as Record<string, string>) ?? {};
  pts += n(pass.passYds) * 0.04;
  pts += n(pass.passTD)  * 4;
  pts -= n(pass.int)     * 3;
  pts += n(pass.passingTwoPointConversion ?? stats.twoPointConversion) * 1;

  // Rushing
  const rush = (stats.Rushing as Record<string, string>) ?? {};
  pts += n(rush.rushYds) * 0.1;
  pts += n(rush.rushTD)  * 6;
  pts += n(rush.rushingTwoPointConversion) * 2;

  // Receiving — TE gets 1.5x PPR
  const rec = (stats.Receiving as Record<string, string>) ?? {};
  pts += pos === "TE" ? n(rec.receptions) * 1.5 : n(rec.receptions) * 1.0;
  pts += n(rec.recYds) * 0.1;
  pts += n(rec.recTD)  * 6;
  pts += n(rec.receivingTwoPointConversion) * 2;

  // Fumbles
  pts -= n((stats.Defense as Record<string, string>)?.fumblesLost) * 3;

  return Math.round(pts * 10) / 10;
}

function calcDSTLive(d: Record<string, string>): number {
  let pts = 0;
  const n = (v: string | undefined) => parseFloat(v ?? "0") || 0;
  pts += n(d.sacks)            * 2;
  pts += n(d.defensiveInterceptions) * 3;
  pts += n(d.fumblesRecovered) * 3;
  pts += n(d.defTD)            * 6;
  pts += n(d.returnTD)         * 6;
  pts += n(d.safeties)         * 2;
  pts += n(d.blockKick)        * 2;

  // Points allowed scoring (standard fantasy)
  const pa = n(d.ptsAgainst);
  if (pa === 0)       pts += 10;
  else if (pa <= 6)   pts += 7;
  else if (pa <= 13)  pts += 4;
  else if (pa <= 17)  pts += 1;
  else if (pa <= 27)  pts += 0;
  else if (pa <= 34)  pts -= 1;
  else                pts -= 4;

  return Math.round(pts * 10) / 10;
}

/**
 * Returns true if the current time is within the game window
 * (from kickoff to ~4 hours after kickoff = final).
 */
function isGameActive(gameDate: string, gameTime: string): boolean {
  if (!gameDate || !gameTime) return false;
  const d = gameDate;
  const datePart = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;
  const offsetHours = 4; // EDT
  const utcHours = hours + offsetHours;
  const kickoffUTC = new Date(`${datePart}T${String(utcHours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:00Z`);
  const finalUTC = new Date(kickoffUTC.getTime() + 4 * 60 * 60 * 1000); // +4h
  const now = Date.now();
  return now >= kickoffUTC.getTime() && now <= finalUTC.getTime();
}

export function useNFLLiveScores(
  week: number,
  season: number,
  matchupMap: NFLMatchupMap
): UseNFLLiveScoresResult {
  const [liveScores, setLiveScores] = useState<LiveScoreMap>({});
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Get list of gameIds that are currently active
  const getActiveGameIds = useCallback((): string[] => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const m of Object.values(matchupMap)) {
      if (m.gameId && !seen.has(m.gameId) && isGameActive(m.gameDate, m.gameTime)) {
        ids.push(m.gameId);
        seen.add(m.gameId);
      }
    }
    return ids;
  }, [matchupMap]);

  const fetchBoxScores = useCallback(async () => {
    const activeGameIds = getActiveGameIds();
    if (activeGameIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const newScores: LiveScoreMap = { ...liveScores };

    for (const gameId of activeGameIds) {
      try {
        const url = `https://${RAPIDAPI_HOST}/getNFLBoxScore?gameID=${gameId}&fantasyPoints=true&twoPointConversions=2&passYards=.04&passTD=4&passInterceptions=-3&pointsPerReception=1&carries=0&rushYards=.1&rushTD=6&fumbles=-3&receivingYards=.1&receivingTD=6&targets=0&defTD=6&fgMade=0&fgYards=.1&xpMade=1`;
        const res = await fetch(url, {
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const body = data?.body ?? {};

        // Player stats
        const playerStats = body.playerStats ?? {};
        for (const p of Object.values(playerStats) as Record<string, unknown>[]) {
          const name = (p.longName as string) ?? "";
          const pos  = (p.pos      as string) ?? "";
          if (!name) continue;
          const pts = calcWRCLive(p, pos);
          newScores[name.toLowerCase()] = pts;
        }

        // Team DST stats
        const teamStats = body.teamStats ?? {};
        for (const [teamAbv, d] of Object.entries(teamStats) as [string, Record<string, string>][]) {
          const normAbv = normalizeAbv(teamAbv);
          const pts = calcDSTLive(d);
          newScores[`dst:${normAbv}`] = pts;
        }
      } catch (err) {
        console.warn(`Failed to fetch box score for game ${gameId}:`, err);
      }
    }

    if (mountedRef.current) {
      setLiveScores(newScores);
      setLastUpdated(new Date());
    }
  }, [getActiveGameIds, liveScores]);

  // Start/stop polling based on active games
  useEffect(() => {
    mountedRef.current = true;

    const schedule = () => {
      const activeIds = getActiveGameIds();
      if (activeIds.length === 0) {
        setIsPolling(false);
        return;
      }
      fetchBoxScores().finally(() => {
        if (mountedRef.current) {
          timerRef.current = setTimeout(schedule, POLL_INTERVAL_MS);
        }
      });
    };

    // Initial fetch
    schedule();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, season, matchupMap]);

  return { liveScores, isPolling, lastUpdated };
}

/**
 * Look up a player's live fantasy points.
 * Returns null if no live data is available (game not started or no data yet).
 */
export function getLivePoints(
  liveScores: LiveScoreMap,
  playerName: string,
  pos: string,
  nflTeam: string
): number | null {
  if (pos === "DST") {
    const normAbv = normalizeAbv(nflTeam);
    const v = liveScores[`dst:${normAbv}`];
    return v !== undefined ? v : null;
  }
  const v = liveScores[playerName.toLowerCase()];
  return v !== undefined ? v : null;
}
