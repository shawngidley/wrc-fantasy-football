/**
 * WRC Free Agents stats loader.
 * Style: fetch only visible rows, cache each Tank01 season line in sessionStorage,
 * and limit concurrency to protect the API and keep the browser responsive.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchPlayerByName } from "@/hooks/useTank01Player";
import { normalizeNFLTeamCode } from "@/lib/nflTeamCodes";
import { DST_SEASON_STATS_2025 } from "@/lib/dstSeasonStats2025";
import { getCompletedKickerSeasonStats } from "@/lib/kickerSeasonStats2025";
import { getCompletedOffenseSeasonStats2025, normalizeCompletedOffenseSeasonStats } from "@/lib/completedOffenseSeasonStats2025";
import { normalizeCompletedDstSeasonStats, normalizeCompletedKickerSeasonStats, normalizeTankSeasonStats, type PlayerSeasonStats } from "@/lib/playerSeasonStats";
import { readSeasonStatsCache, writeSeasonStatsCache, type SeasonStatsCacheEntry } from "@/lib/seasonStatsCache";
import { getDraftUniversePlayerByName } from "@shared/draftPlayerUniverse";
import { normalizePlayerName } from "@shared/playerNameMatch";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";

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
    const uncached = players.filter((player) => {
      const cached = cacheGet(player.name);
      const completedOffenseSource = ["QB", "RB", "WR", "TE"].includes(player.pos);
      // Draft Players deliberately disables provider fallback. Its completed 2025
      // snapshot is authoritative, so a prior browser entry must not mask a
      // corrected WRC total or FP/G value.
      const ignoreCachedOffense = !allowProviderFallback && completedOffenseSource;
      if (cached && !ignoreCachedOffense) {
        next[player.name.toLowerCase()] = cached.stats;
        nextMeta[player.name.toLowerCase()] = { age: cached.age, headshot: cached.headshot };
      }
      const needsIdentityRefresh = allowProviderFallback && player.pos !== "DST" && (!cached?.age || !cached?.headshot);
      return !cached || ignoreCachedOffense || needsIdentityRefresh;
    });

    setStatMap(next);
    setPlayerMetaMap(nextMeta);
    setLoadedCount(Object.keys(next).length);
    setLoading(uncached.length > 0);
    const dstPlayers = uncached.filter(player => player.pos === "DST" && player.nflTeam);
    const exactKickers = uncached.filter(player => player.pos === "K" && Boolean(getCompletedKickerSeasonStats(player.name)));
    // Kicker FPTS must come from exact completed kick events. Do not fall back to
    // Tank01's aggregate line: it cannot reproduce WRC distance scoring, and a
    // transient provider response should not hold up the entire K table.
    const offensePlayers = uncached.filter(player => ["QB", "RB", "WR", "TE"].includes(player.pos));
    const individualPlayers = uncached.filter(player => player.pos !== "K" && (player.pos !== "DST" || !player.nflTeam));

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
        const tankPlayer = await fetchPlayerByName(player.name);
        if (cancelled) return;
        const exactKickerSeason = player.pos === "K" ? getCompletedKickerSeasonStats(player.name) : undefined;
        const key = player.name.toLowerCase();
        // Only fall back to a live Tank01 stats line when the caller
        // actually allows it -- Lineup.tsx passes allowProviderFallback:
        // false specifically so a player missing from the completed-season
        // snapshot doesn't get a live/incomplete value substituted in. That
        // restriction is about which stats source is authoritative; it has
        // no bearing on age/headshot below, which should always be fetched.
        const liveStats = allowProviderFallback
          ? (exactKickerSeason
            ? normalizeCompletedKickerSeasonStats(exactKickerSeason)
            : normalizeTankSeasonStats(tankPlayer?.stats, player.pos))
          : undefined;
        const stats = next[key] ?? liveStats;
        const universePlayer = getDraftUniversePlayerByName(player.name);
        const espnAge = tankPlayer?.age || await fetchEspnAge(universePlayer?.sourcePlayerId ?? undefined);
        const meta = {
          age: espnAge,
          headshot: tankPlayer?.espnHeadshot ?? getEspnHeadshotUrl(universePlayer?.sourcePlayerId) ?? undefined,
        };
        if (stats) {
          cacheSet(player.name, { stats, ...meta });
          next[key] = stats;
          setStatMap({ ...next });
        }
        nextMeta[key] = meta;
        setPlayerMetaMap({ ...nextMeta });
        setLoadedCount(Object.keys(next).length);
      }
    }

    void (async () => {
      await Promise.all([loadDstStats(), loadExactKickerStats()]);
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

  return { statMap, playerMetaMap, loading, loadedCount };
}
