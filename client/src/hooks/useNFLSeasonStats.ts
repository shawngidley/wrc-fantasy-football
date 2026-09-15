/**
 * WRC Free Agents stats loader.
 * Style: fetch only visible rows, cache each Tank01 season line in sessionStorage,
 * and limit concurrency to protect the API and keep the browser responsive.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchPlayerByName, fetchNFLTeams } from "@/hooks/useTank01Player";
import { normalizeNFLTeamCode } from "@shared/nflTeamCodes";
import { DST_SEASON_STATS_2025 } from "@/lib/dstSeasonStats2025";
import { getCompletedKickerSeasonStats } from "@/lib/kickerSeasonStats2025";
import { getCompletedOffenseSeasonStats2025, normalizeCompletedOffenseSeasonStats } from "@/lib/completedOffenseSeasonStats2025";
import { normalizeCompletedDstSeasonStats, normalizeCompletedKickerSeasonStats, normalizeTankSeasonStats, normalizeTankTeamSeasonStats, type PlayerSeasonStats } from "@/lib/playerSeasonStats";
import { readSeasonStatsCache, writeSeasonStatsCache, type SeasonStatsCacheEntry } from "@/lib/seasonStatsCache";
import { getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";
import { isSeason2026Underway } from "@/lib/scheduleData2026";

export interface SeasonStatsPlayerInput {
  name: string;
  pos: string;
  nflTeam?: string;
}

const CONCURRENCY = 4;

async function fetchEspnAge(athleteId?: string): Promise<string | undefined> {
  if (!athleteId) return undefined;
  try {
    const response = await fetch(`/api/espn/athlete/${encodeURIComponent(athleteId)}`);
    if (!response.ok) return undefined;
    const data = await response.json() as { athlete?: { age?: number | string } };
    // ESPN's actual response shape has age directly (confirmed via direct
    // inspection: fields include 'age' and 'displayDOB', not 'birthDate'
    // as originally assumed) -- no need to compute it from a birth date at
    // all, and getAgeFromBirthDate was always operating on a field that
    // simply doesn't exist in this response, which is the real reason
    // ages never appeared regardless of whether the fetch itself succeeded.
    return data.athlete?.age != null ? String(data.athlete.age) : undefined;
  } catch { return undefined; }
}

function cacheGet(name: string): SeasonStatsCacheEntry | null {
  try {
    return typeof window === "undefined" ? null : readSeasonStatsCache(window.localStorage, name);
  } catch {
    return null;
  }
}

function cacheSet(name: string, data: SeasonStatsCacheEntry) {
  try {
    if (typeof window !== "undefined") writeSeasonStatsCache(window.localStorage, name, data);
  } catch {
    // Cache is an enhancement only; the table still works without it.
  }
}

export function useNFLSeasonStats(players: SeasonStatsPlayerInput[], enabled: boolean, allowProviderFallback = true) {
  const [statMap, setStatMap] = useState<Record<string, PlayerSeasonStats>>({});
  const [zeroGpDebug, setZeroGpDebug] = useState<string[]>([]);
  const [playerMetaMap, setPlayerMetaMap] = useState<Record<string, { age?: string; headshot?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const requestKey = useMemo(
    () => players.map(player => `${player.name}:${player.pos}`).join("|") ,
    [players]
  );

  useEffect(() => {
    if (!enabled || !players.length) {
      setLoading(false);
      setLoadedCount(0);
      return;
    }

    let cancelled = false;
    const next: Record<string, PlayerSeasonStats> = {};
    const nextMeta: Record<string, { age?: string; headshot?: string }> = {};
    // Once the 2026 season is actually underway, "current season" means
    // 2026, not 2025's now-completed season -- confirmed live: this page
    // was showing 2025's stats indefinitely, since the completed-season
    // paths below ran unconditionally regardless of what season it
    // actually was. allowProviderFallback's caller-supplied value (e.g.
    // Lineup.tsx's false) was specifically about protecting the 2025
    // completed snapshot from being overwritten by a live fetch -- once
    // there's no 2025 snapshot being used at all, that protection no
    // longer applies, so this override always allows live data through
    // once 2026 has started, regardless of what the caller passed.
    const season2026Underway = isSeason2026Underway();
    const effectiveAllowProviderFallback = allowProviderFallback || season2026Underway;
    const uncached = players.filter((player) => {
      const cached = cacheGet(player.name);
      const completedOffenseSource = ["QB", "RB", "WR", "TE"].includes(player.pos);
      // Draft Players deliberately disables provider fallback. Its completed 2025
      // snapshot is authoritative, so a prior browser entry must not mask a
      // corrected WRC total or FP/G value.
      const ignoreCachedOffense = !effectiveAllowProviderFallback && completedOffenseSource;
      if (cached && !ignoreCachedOffense) {
        next[player.name.toLowerCase()] = cached.stats;
        nextMeta[player.name.toLowerCase()] = { age: cached.age, headshot: cached.headshot };
      }
      const needsIdentityRefresh = effectiveAllowProviderFallback && player.pos !== "DST" && (!cached?.age || !cached?.headshot);
      return !cached || ignoreCachedOffense || needsIdentityRefresh;
    });

    setStatMap(next);
    setPlayerMetaMap(nextMeta);
    setLoadedCount(Object.keys(next).length);
    setLoading(uncached.length > 0);
    const dstPlayers = !season2026Underway ? uncached.filter(player => player.pos === "DST" && player.nflTeam) : [];
    const liveDstPlayers = season2026Underway ? uncached.filter(player => player.pos === "DST" && player.nflTeam) : [];
    const exactKickers = !season2026Underway ? uncached.filter(player => player.pos === "K" && Boolean(getCompletedKickerSeasonStats(player.name))) : [];
    // Kicker FPTS must come from exact completed kick events. Do not fall back to
    // Tank01's aggregate line: it cannot reproduce WRC distance scoring, and a
    // transient provider response should not hold up the entire K table.
    // (2025 only -- once 2026 is underway there's no "completed" kick-event
    // snapshot to be exact about yet, so kickers fall through to worker()'s
    // live Tank01 aggregate below, same as every other individual player.)
    const offensePlayers = !season2026Underway ? uncached.filter(player => ["QB", "RB", "WR", "TE"].includes(player.pos)) : [];
    const individualPlayers = uncached.filter(player => {
      if (player.pos === "DST" && player.nflTeam) return false; // handled by loadDstStats or loadLiveDstStats above
      if (!season2026Underway && player.pos === "K") return false; // handled by loadExactKickerStats
      if (!season2026Underway && ["QB", "RB", "WR", "TE"].includes(player.pos)) return false; // handled by loadCompletedOffenseStats
      return true;
    });

    async function loadDstStats() {
      if (!dstPlayers.length) return;
      if (cancelled) return;
      for (const player of dstPlayers) {
        const teamCode = normalizeNFLTeamCode(player.nflTeam ?? "");
        const completedSeason = DST_SEASON_STATS_2025[teamCode];
        if (!completedSeason) continue;
        const stats = normalizeCompletedDstSeasonStats(completedSeason);
        cacheSet(player.name, { stats });
        next[player.name.toLowerCase()] = stats;
        setStatMap({ ...next });
        setLoadedCount(Object.keys(next).length);
      }
    }

    async function loadLiveDstStats() {
      if (!liveDstPlayers.length) return;
      if (cancelled) return;
      const teams = await fetchNFLTeams(true);
      if (cancelled) return;
      const teamsByAbv = new Map(teams.map(team => [normalizeNFLTeamCode(team.teamAbv), team]));
      for (const player of liveDstPlayers) {
        const teamCode = normalizeNFLTeamCode(player.nflTeam ?? "");
        const team = teamsByAbv.get(teamCode);
        if (!team) continue;
        const stats = normalizeTankTeamSeasonStats(team);
        cacheSet(player.name, { stats });
        next[player.name.toLowerCase()] = stats;
        setStatMap({ ...next });
        setLoadedCount(Object.keys(next).length);
      }
    }

    async function loadExactKickerStats() {
      for (const player of exactKickers) {
        const completedSeason = getCompletedKickerSeasonStats(player.name);
        if (!completedSeason) continue;
        const stats = normalizeCompletedKickerSeasonStats(completedSeason);
        const tankPlayer = await fetchPlayerByName(player.name);
        const universePlayer = getDraftUniversePlayerByName(player.name);
        const age = tankPlayer?.age || await fetchEspnAge(universePlayer?.sourcePlayerId ?? undefined);
        const headshot = tankPlayer?.espnHeadshot ?? getEspnHeadshotUrl(universePlayer?.sourcePlayerId) ?? undefined;
        cacheSet(player.name, { stats, age, headshot });
        next[player.name.toLowerCase()] = stats;
        nextMeta[player.name.toLowerCase()] = { age, headshot };
        setStatMap({ ...next });
        setPlayerMetaMap({ ...nextMeta });
        setLoadedCount(Object.keys(next).length);
      }
    }

    async function loadCompletedOffenseStats() {
      if (!offensePlayers.length) return new Set<string>();
      const completed = await getCompletedOffenseSeasonStats2025();
      // Build a normalized-key index once rather than re-scanning on every
      // lookup. Using the shared normalizePlayerName() here (instead of the
      // old local COMPLETED_SEASON_ALIASES table) means any name-variant
      // fix added to that shared module -- suffixes, apostrophes, known
      // nickname aliases -- automatically applies here too, rather than
      // needing a duplicate one-off alias added in this file every time a
      // new mismatch is discovered.
      const completedByNormalizedName: Record<string, string> = {};
      for (const key of Object.keys(completed)) {
        completedByNormalizedName[normalizePlayerName(key)] = key;
      }
      const completedNames = new Set<string>();
      for (const player of offensePlayers) {
        const matchedKey = completedByNormalizedName[normalizePlayerName(player.name)];
        const line = matchedKey ? completed[matchedKey] : undefined;
        if (!line || !["QB", "RB", "WR", "TE"].includes(player.pos)) continue;
        const stats = normalizeCompletedOffenseSeasonStats(line);
        cacheSet(player.name, { stats });
        next[player.name.toLowerCase()] = stats;
        completedNames.add(player.name);
      }
      if (completedNames.size) {
        setStatMap({ ...next });
        setLoadedCount(Object.keys(next).length);
      }
      return completedNames;
    }

    async function worker() {
      while (!cancelled && individualPlayers.length) {
        const player = individualPlayers.shift();
        if (!player) return;
        const key = player.name.toLowerCase();

        // Check the cache BEFORE fetching. This was the actual bug: this
        // cache was being written to (cacheSet below) but never read from
        // first, so it was write-only and did nothing to prevent
        // redundant fetches -- every single load of this hook re-fetched
        // every player from Tank01 via fetchPlayerByName (a slow, ~2.5s
        // individual network call) regardless of how recently that same
        // player had already been fetched and cached. Confirmed live via
        // Tank01's own request logs: a burst of ~48 back-to-back "Get
        // Player Information" calls on a single page load.
        const cached = cacheGet(player.name);
        if (cached) {
          if (cached.stats && !next[key]) {
            next[key] = cached.stats;
            setStatMap({ ...next });
          }
          nextMeta[key] = { age: cached.age, headshot: cached.headshot };
          setPlayerMetaMap({ ...nextMeta });
          setLoadedCount(Object.keys(next).length);
          continue;
        }

        const tankPlayer = await fetchPlayerByName(player.name);
        if (cancelled) return;
        const exactKickerSeason = (!season2026Underway && player.pos === "K") ? getCompletedKickerSeasonStats(player.name) : undefined;
        // Only fall back to a live Tank01 stats line when the caller
        // actually allows it -- Lineup.tsx passes allowProviderFallback:
        // false specifically so a player missing from the completed-season
        // snapshot doesn't get a live/incomplete value substituted in. That
        // restriction is about which stats source is authoritative; it has
        // no bearing on age/headshot below, which should always be fetched.
        // (Once 2026 is underway, effectiveAllowProviderFallback is always
        // true regardless of the caller's value -- there's no 2025 snapshot
        // left to protect.)
        const liveStats = effectiveAllowProviderFallback
          ? (exactKickerSeason
            ? normalizeCompletedKickerSeasonStats(exactKickerSeason)
            : normalizeTankSeasonStats(tankPlayer?.stats, player.pos))
          : undefined;
        const stats = next[key] ?? liveStats;
        if (liveStats && liveStats.gp === 0 && tankPlayer && tankPlayer.isFreeAgent !== "True" && !tankPlayer.injury?.designation) {
          setZeroGpDebug(prev => [...prev, `${player.name} (${player.pos}, ${player.nflTeam}): raw tankPlayer=${JSON.stringify(tankPlayer)}`]);
        }
        const universePlayer = getDraftUniversePlayerByName(player.name);
        const espnAge = tankPlayer?.age || await fetchEspnAge(universePlayer?.sourcePlayerId ?? undefined);
        const meta = {
          age: espnAge,
          headshot: tankPlayer?.espnHeadshot ?? getEspnHeadshotUrl(universePlayer?.sourcePlayerId) ?? undefined,
        };
        if (stats) {
          // Confirmed live: a fetched result showing 0 games played can
          // reflect Tank01 not yet having finished processing a very
          // recently completed game into its season aggregate (not the
          // player genuinely having 0 games) -- caching that for the
          // full 24-hour TTL would permanently lock in a stale, transient
          // zero result even after Tank01 catches up. Skip caching in
          // that case so the next load simply retries.
          if (stats.gp > 0) cacheSet(player.name, { stats, ...meta });
          next[key] = stats;
          setStatMap({ ...next });
        }
        nextMeta[key] = meta;
        setPlayerMetaMap({ ...nextMeta });
        setLoadedCount(Object.keys(next).length);
      }
    }

    void (async () => {
      await Promise.all([loadDstStats(), loadLiveDstStats(), loadExactKickerStats()]);
      await loadCompletedOffenseStats();
      // Previously individualPlayers was spliced down to empty whenever
      // allowProviderFallback was false (as Lineup.tsx always passes),
      // which meant worker() -- the only code path that fetches age and
      // headshot for non-kicker players -- never ran at all on that page.
      // That flag was only ever meant to stop the completed-season stats
      // value itself from being overwritten by a live provider fetch;
      // worker() already respects that correctly on its own via
      // `next[key] ?? (...)`, reusing whatever authoritative stats value
      // already exists rather than recomputing it. Age/headshot have
      // nothing to do with stats-source authority, so they shouldn't have
      // been gated behind the same flag.
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, individualPlayers.length) }, () => worker()));
    })()
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [requestKey, enabled]);

  return { statMap, playerMetaMap, loading, loadedCount, zeroGpDebug };
}
