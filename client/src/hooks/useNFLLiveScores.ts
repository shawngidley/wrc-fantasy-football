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
import { calculateWrcKickerPoints, getKickerEventsForPlayer, parseEspnKickerEvents, type KickerPlayEvent } from "@/lib/espnKickerEvents";
import { calcFantasyPoints, type Tank01Stats } from "@/lib/scoringEngine";

const TANK01_BASE_URL = "/api/tank01";
const POLL_INTERVAL_MS = 30_000; // 30 seconds

/** Map of lowercase player name → live WRC fantasy points */
export type LiveScoreMap = Record<string, number>;
export type KickerEventMap = KickerPlayEvent[];

interface UseNFLLiveScoresResult {
  liveScores: LiveScoreMap;
  isPolling: boolean;
  lastUpdated: Date | null;
  kickerEvents: KickerEventMap;
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

function calcWRCLive(stats: Record<string, unknown>, pos: string): number {
  return calcFantasyPoints(stats as Tank01Stats, pos);
}

function calcDSTLive(d: Record<string, string>): number {
  return calcFantasyPoints({ Defense: d }, "DST");
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
  const [kickerEvents, setKickerEvents] = useState<KickerEventMap>([]);
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

  const getActiveGames = useCallback(() => {
    const games = new Map<string, { gameDate: string; home: string; away: string }>();
    for (const [team, matchup] of Object.entries(matchupMap)) {
      if (!matchup.gameId || !isGameActive(matchup.gameDate, matchup.gameTime)) continue;
      const home = matchup.isHome ? team : matchup.opponent;
      const away = matchup.isHome ? matchup.opponent : team;
      games.set(matchup.gameId, { gameDate: matchup.gameDate, home: normalizeAbv(home), away: normalizeAbv(away) });
    }
    return Array.from(games.values());
  }, [matchupMap]);

  const fetchEspnKickerEvents = useCallback(async (activeGames: Array<{ gameDate: string; home: string; away: string }>) => {
    const events: KickerPlayEvent[] = [];
    const seen = new Set<string>();
    const dates = Array.from(new Set(activeGames.map(game => game.gameDate)));
    for (const date of dates) {
      try {
        const scoreboard = await fetch(`/api/espn/scoreboard?dates=${date}`);
        if (!scoreboard.ok) continue;
        const payload = await scoreboard.json() as { events?: Array<{ id?: string; competitions?: Array<{ competitors?: Array<{ homeAway?: string; team?: { abbreviation?: string } }> }> }> };
        for (const game of activeGames.filter(candidate => candidate.gameDate === date)) {
          const event = payload.events?.find(candidate => {
            const competitors = candidate.competitions?.[0]?.competitors ?? [];
            const home = competitors.find(item => item.homeAway === "home")?.team?.abbreviation;
            const away = competitors.find(item => item.homeAway === "away")?.team?.abbreviation;
            return normalizeAbv(home ?? "") === game.home && normalizeAbv(away ?? "") === game.away;
          });
          if (!event?.id) continue;
          const summary = await fetch(`/api/espn/summary?event=${event.id}`);
          if (!summary.ok) continue;
          for (const play of parseEspnKickerEvents(await summary.json())) {
            const key = `${play.playerName}|${play.type}|${play.outcome}|${play.yards}|${play.text}`;
            if (!seen.has(key)) { seen.add(key); events.push(play); }
          }
        }
      } catch (error) {
        console.warn("Failed to retrieve ESPN kicker play-by-play", error);
      }
    }
    return events;
  }, []);

  const fetchBoxScores = useCallback(async () => {
    const activeGameIds = getActiveGameIds();
    const activeGames = getActiveGames();
    if (activeGameIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const newScores: LiveScoreMap = { ...liveScores };

    const espnEvents = await fetchEspnKickerEvents(activeGames);
    for (const gameId of activeGameIds) {
      try {
        const url = `${TANK01_BASE_URL}/getNFLBoxScore?gameID=${gameId}&fantasyPoints=true&twoPointConversions=2&passYards=.04&passTD=4&passInterceptions=-3&pointsPerReception=1&carries=0&rushYards=.1&rushTD=6&fumbles=-3&receivingYards=.1&receivingTD=6&targets=0&defTD=6&fgMade=0&fgYards=.1&xpMade=1`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const body = data?.body ?? {};

        // Player stats
        const playerStats = body.playerStats ?? {};
        for (const p of Object.values(playerStats) as Record<string, unknown>[]) {
          const name = (p.longName as string) ?? "";
          const pos  = (p.pos      as string) ?? "";
          if (!name) continue;
          const kickerPlays = pos === "K" ? getKickerEventsForPlayer(espnEvents, name) : [];
          const pts = pos === "K" && kickerPlays.length > 0 ? calculateWrcKickerPoints(kickerPlays) : calcWRCLive(p, pos);
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
      setKickerEvents(espnEvents);
      setLastUpdated(new Date());
    }
  }, [fetchEspnKickerEvents, getActiveGameIds, getActiveGames, liveScores]);

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

  return { liveScores, isPolling, lastUpdated, kickerEvents };
}

/**
 * Look up a player's live fantasy points.
 * Returns null if no live data is available (game not started or no data yet).
 */
export function getLivePoints(
  liveScores: LiveScoreMap,
  playerName: string,
  pos: string,
  nflTeam: string,
  kickerEvents: KickerEventMap = [],
): number | null {
  if (pos === "DST") {
    const normAbv = normalizeAbv(nflTeam);
    const v = liveScores[`dst:${normAbv}`];
    return v !== undefined ? v : null;
  }
  if (pos === "K") {
    const events = getKickerEventsForPlayer(kickerEvents, playerName);
    if (events.length > 0) return calculateWrcKickerPoints(events);
  }
  const v = liveScores[playerName.toLowerCase()];
  return v !== undefined ? v : null;
}
