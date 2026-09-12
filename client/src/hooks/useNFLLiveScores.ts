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
/** Map of lowercase player name (or dst:TEAM) → raw Tank01 stats, for
 * building the per-player stat-chip display alongside their points. */
export type LiveStatsMap = Record<string, Tank01Stats>;
export type KickerEventMap = KickerPlayEvent[];

interface UseNFLLiveScoresResult {
  liveScores: LiveScoreMap;
  liveStats: LiveStatsMap;
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
 * Returns true if the current time is within the game's fetchable window:
 * from kickoff through the rest of that WRC week (roughly 6 days). This
 * governs whether a game is included in the box-score fetch list at all --
 * NOT just whether it's still actively being played.
 *
 * Deliberately generous rather than cutting off shortly after a typical
 * game's expected duration: liveScores/liveStats are purely in-memory
 * state (useState, no persistence), so a game excluded from this window
 * is permanently unreachable until the page fully reloads with it back in
 * range. A narrower cutoff (this used to be kickoff + 4h) meant that once
 * a completed game passed that mark, any fresh page load -- checking the
 * score again later that night, the next day, or later in the week --
 * would never fetch its data at all and would show 0 forever, even
 * though the final stats were fully available from Tank01 the whole
 * time. The actual cost of the wider window is bounded and modest: a few
 * dozen already-final games get harmlessly re-fetched each poll for the
 * rest of the week rather than none.
 */
function isGameActive(gameDate: string, gameTime: string): boolean {
  if (!gameDate || !gameTime) return false;
  const d = gameDate;
  const year = parseInt(d.slice(0,4), 10);
  const month = parseInt(d.slice(4,6), 10) - 1; // Date.UTC months are 0-indexed
  const day = parseInt(d.slice(6,8), 10);
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;
  const offsetHours = 4; // EDT
  // Date.UTC correctly rolls hour overflow into the next day (e.g. an
  // 8:20pm ET kickoff -> 20+4=24 -> the next day at 00:20 UTC) --
  // constructing this same value as an ISO string ("...T24:20:00Z")
  // does NOT handle that overflow and silently produces an Invalid
  // Date instead, which was making every game at 8pm ET or later
  // (a large share of all NFL games, including every primetime slot)
  // never register as active, so live scores were never fetched for
  // them at all.
  const kickoffUTC = new Date(Date.UTC(year, month, day, hours + offsetHours, mins, 0));
  const windowEndUTC = new Date(kickoffUTC.getTime() + 6 * 24 * 60 * 60 * 1000); // +6 days
  const now = Date.now();
  return now >= kickoffUTC.getTime() && now <= windowEndUTC.getTime();
}

/**
 * Narrower than isGameActive -- used specifically to decide whether the
 * recurring 30-second poll should keep re-scheduling itself, as opposed
 * to isGameActive's much wider 6-day window (which decides which games
 * are eligible to be fetched AT ALL, including on a fresh page load well
 * after a game has finished, so its final stats still populate).
 *
 * Without this distinction, the scheduling loop below -- which stops
 * polling once getActiveGameIds() returns empty -- never actually
 * stopped for the entire 6-day window once any game kicked off, since
 * isGameActive alone stayed true that whole time. That meant every open
 * Live Scoring tab kept re-fetching Tank01's box score every 30 seconds,
 * continuously, for days after a game had already finished -- confirmed
 * as the direct cause of the Tank01 quota being exhausted after just
 * one game.
 *
 * Roughly covers a game's actual duration plus overtime buffer; once no
 * game is within this narrower window, the poll stops rescheduling
 * itself (after one final fetch to still capture each game's last
 * update), while isGameActive's wider window keeps those same games
 * fetchable on any later page load for the rest of the week.
 */
function isLikelyStillInProgress(gameDate: string, gameTime: string): boolean {
  if (!gameDate || !gameTime) return false;
  const d = gameDate;
  const year = parseInt(d.slice(0,4), 10);
  const month = parseInt(d.slice(4,6), 10) - 1;
  const day = parseInt(d.slice(6,8), 10);
  const timeMatch = gameTime.match(/(\d+):(\d+)([ap])/i);
  if (!timeMatch) return false;
  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;
  const offsetHours = 4; // EDT
  const kickoffUTC2 = new Date(Date.UTC(year, month, day, hours + offsetHours, mins, 0));
  const likelyEndUTC = new Date(kickoffUTC2.getTime() + 4.5 * 60 * 60 * 1000); // +4.5h
  const now2 = Date.now();
  return now2 >= kickoffUTC2.getTime() && now2 <= likelyEndUTC.getTime();
}

export function useNFLLiveScores(
  week: number,
  season: number,
  matchupMap: NFLMatchupMap
): UseNFLLiveScoresResult {
  const [liveScores, setLiveScores] = useState<LiveScoreMap>({});
  const [liveStats, setLiveStats] = useState<LiveStatsMap>({});
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [kickerEvents, setKickerEvents] = useState<KickerEventMap>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Once polling has genuinely stopped for a given week (no game likely
  // still in progress), this guarantees it stays stopped for that week
  // regardless of how many times the effect below re-runs -- observed
  // live: something is causing this effect to re-run roughly every 5
  // minutes well after a game had finished, and each re-run's
  // unconditional "initial fetch" was still hitting Tank01 for every
  // game in the wide 6-day window every time, even though the recurring
  // 30s timer itself correctly stopped in between. This ref persists
  // across those re-runs (useRef survives effect cleanup/re-setup within
  // the same component instance) and is checked before any fetch at all.
  const stoppedForWeekRef = useRef<number | null>(null);

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
    const games = new Map<string, { gameId: string; gameDate: string; home: string; away: string }>();
    for (const [team, matchup] of Object.entries(matchupMap)) {
      if (!matchup.gameId || !isGameActive(matchup.gameDate, matchup.gameTime)) continue;
      const home = matchup.isHome ? team : matchup.opponent;
      const away = matchup.isHome ? matchup.opponent : team;
      games.set(matchup.gameId, { gameId: matchup.gameId, gameDate: matchup.gameDate, home: normalizeAbv(home), away: normalizeAbv(away) });
    }
    return Array.from(games.values());
  }, [matchupMap]);

  // Used by the scheduling loop below to decide whether to keep
  // rescheduling the recurring poll -- deliberately the narrower
  // isLikelyStillInProgress window, not isGameActive's wide 6-day
  // fetch-eligibility window. See isLikelyStillInProgress's comment for
  // why this distinction is what actually stops runaway polling.
  const hasAnyGameLikelyInProgress = useCallback((): boolean => {
    for (const m of Object.values(matchupMap)) {
      if (m.gameId && isLikelyStillInProgress(m.gameDate, m.gameTime)) return true;
    }
    return false;
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
    const newStats: LiveStatsMap = { ...liveStats };
    // Tank01's getNFLBoxScore response keys teamStats by the literal
    // strings "home" and "away", not by team abbreviation -- confirmed
    // live via console diagnostics: `{ away: {...}, home: {...} }`, no
    // team code anywhere in that object. Every DST score lookup elsewhere
    // in this file correctly searches for the real team abbreviation
    // (e.g. dst:SEA), so scores stored under the literal keys dst:HOME /
    // dst:AWAY were never found by anything -- meaning DST scoring never
    // actually worked for any team, not just the one team that happened
    // to get noticed first. This lookup maps each game's home/away teamStats
    // entry back to the real team code already known from the schedule.
    const gameTeams = new Map(activeGames.map(g => [g.gameId, { home: g.home, away: g.away }]));

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
          const pts = pos === "K" && kickerPlays.length > 0 ? calculateWrcKickerPoints(kickerPlays, p as Tank01Stats) : calcWRCLive(p, pos);
          newScores[name.toLowerCase()] = pts;
          newStats[name.toLowerCase()] = p as Tank01Stats;
        }

        // Team DST stats
        const teamStats = body.teamStats ?? {};
        const teams = gameTeams.get(gameId);
        for (const [homeAway, d] of Object.entries(teamStats) as [string, Record<string, string>][]) {
          const teamAbv = homeAway === "home" ? teams?.home : homeAway === "away" ? teams?.away : undefined;
          if (!teamAbv) continue;
          const pts = calcDSTLive(d);
          newScores[`dst:${teamAbv}`] = pts;
          newStats[`dst:${teamAbv}`] = { Defense: d };
        }
      } catch (err) {
        console.warn(`Failed to fetch box score for game ${gameId}:`, err);
      }
    }

    if (mountedRef.current) {
      setLiveScores(newScores);
      setLiveStats(newStats);
      setKickerEvents(espnEvents);
      setLastUpdated(new Date());
    }
  }, [fetchEspnKickerEvents, getActiveGameIds, getActiveGames, liveScores, liveStats]);

  // Start/stop polling based on active games
  useEffect(() => {
    mountedRef.current = true;

    const schedule = () => {
      if (stoppedForWeekRef.current === week) {
        setIsPolling(false);
        return;
      }
      const activeIds = getActiveGameIds();
      if (activeIds.length === 0) {
        setIsPolling(false);
        return;
      }
      fetchBoxScores().finally(() => {
        if (mountedRef.current && hasAnyGameLikelyInProgress()) {
          timerRef.current = setTimeout(schedule, POLL_INTERVAL_MS);
        } else {
          stoppedForWeekRef.current = week;
          setIsPolling(false);
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

  return { liveScores, liveStats, isPolling, lastUpdated, kickerEvents };
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
  liveStats: LiveStatsMap = {},
): number | null {
  if (pos === "DST") {
    const normAbv = normalizeAbv(nflTeam);
    const v = liveScores[`dst:${normAbv}`];
    if (v === undefined) {
      console.log(`[DST DEBUG 2] no score found for "${playerName}" -- nflTeam param: "${nflTeam}", normalized to: "${normAbv}", key looked up: "dst:${normAbv}". Available dst: keys:`, Object.keys(liveScores).filter(k => k.startsWith("dst:")));
    }
    return v !== undefined ? v : null;
  }
  if (pos === "K") {
    const events = getKickerEventsForPlayer(kickerEvents, playerName);
    const rawStats = liveStats[playerName.toLowerCase()];
    const fromEvents = events.length > 0 ? calculateWrcKickerPoints(events, rawStats) : null;
    const fromLiveScores = liveScores[playerName.toLowerCase()];
    // Defend against either source being independently stale/incomplete:
    // the ESPN-derived kickerEvents state and the Tank01-derived
    // liveScores value are computed on separate fetch cycles and can
    // disagree, most notably right after a game exits its active polling
    // window with only partial events captured. Take whichever is
    // higher rather than unconditionally preferring the event-based
    // recomputation, since a kicker's true total should never be lower
    // than what either source has already independently confirmed.
    if (fromEvents !== null && fromLiveScores !== undefined) return Math.max(fromEvents, fromLiveScores);
    if (fromEvents !== null) return fromEvents;
    if (fromLiveScores !== undefined) return fromLiveScores;
    return null;
  }
  const v = liveScores[playerName.toLowerCase()];
  return v !== undefined ? v : null;
}

/** Look up a player's raw live stats (for building the stat-chip display),
 * following the same DST vs. individual-player lookup as getLivePoints. */
export function getLiveStats(
  liveStats: LiveStatsMap,
  playerName: string,
  pos: string,
  nflTeam: string,
): Tank01Stats | null {
  if (pos === "DST") {
    const normAbv = normalizeAbv(nflTeam);
    return liveStats[`dst:${normAbv}`] ?? null;
  }
  return liveStats[playerName.toLowerCase()] ?? null;
}
