/**
 * useESPNSeasonStats — fetches per-season stats for an NFL player
 * using the ESPN gamelog public API (sum of per-game stats).
 *
 * Endpoint: site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espnId}/gamelog?season={year}
 * Sums all regular-season game stats to produce season totals.
 *
 * Returns a list of SeasonStatRow objects sorted newest-first.
 * Caches in sessionStorage (24h TTL).
 */
import { useState, useEffect } from "react";
import { calcFantasyPoints } from "@/lib/scoringEngine";

const ESPN_GAMELOG = "https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes";
const CACHE_PREFIX = "wrc_espn_gl_v8_";
const CACHE_NAMESPACE = "wrc_espn_gl_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function clearObsoleteHistoryCaches(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  const obsoleteKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(CACHE_NAMESPACE) && !key.startsWith(CACHE_PREFIX)) obsoleteKeys.push(key);
  }
  obsoleteKeys.forEach(key => storage.removeItem(key));
}

export interface SeasonStatRow {
  season: number;
  team?: string;
  gp: number;
  // Passing
  passYds?: number;
  passTD?: number;
  passInt?: number;
  passAtt?: number;
  passCmp?: number;
  passCmpPct?: number;
  passRating?: number;
  // Rushing
  rushYds?: number;
  rushTD?: number;
  rushAtt?: number;
  rushAvg?: number;
  // Receiving
  rec?: number;
  recYds?: number;
  recTD?: number;
  recTargets?: number;
  recAvg?: number;
  // Kicking
  fgMade?: number;
  fgAtt?: number;
  fgPct?: number;
  xpMade?: number;
  xpAtt?: number;
  // Defense
  sacks?: number;
  defInt?: number;
  defTD?: number;
  fumblesRecovered?: number;
  // Fumbles (all positions)
  fumbles?: number;
  fumblesLost?: number;
  // WRC fantasy points (calculated via scoring engine)
  wrcPts?: number;
  wrcPtsPerGame?: number;
}

export interface UseESPNSeasonStatsResult {
  seasons: SeasonStatRow[];
  loading: boolean;
  error: string | null;
}

/** Sum an array of per-game stat arrays using the label index map */
function sumGameStats(
  events: Array<{ stats?: string[] }>,
  labelMap: Record<string, number>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const ev of events) {
    const stats = ev.stats ?? [];
    for (const [label, idx] of Object.entries(labelMap)) {
      const val = parseFloat(stats[idx] ?? "0") || 0;
      totals[label] = (totals[label] ?? 0) + val;
    }
  }
  return totals;
}

/** Build a label→index map from the ESPN gamelog labels array */
function buildLabelMap(labels: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  // ESPN gamelog has duplicate labels (e.g. "YDS" appears for both passing and rushing)
  // We track occurrence count to disambiguate
  const seen: Record<string, number> = {};
  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    const count = seen[lbl] ?? 0;
    seen[lbl] = count + 1;
    // Use occurrence suffix for duplicates: YDS_0, YDS_1
    map[`${lbl}_${count}`] = i;
    // Also map first occurrence without suffix for convenience
    if (count === 0) map[lbl] = i;
  }
  return map;
}

/** Extract a SeasonStatRow from summed game stats + label map */
export function extractFromGamelog(
  totals: Record<string, number>,
  gp: number,
  labels: string[]
): Partial<SeasonStatRow> {
  const r: Partial<SeasonStatRow> = { gp };
  const lm = buildLabelMap(labels);

  // ESPN labels are grouped by stat category. Locate duplicate YDS/TD values by
  // the group they follow instead of assuming every position uses the same order.
  const totalAtLabelIndex = (targetIndex: number, label: string): number => {
    const occurrence = labels.slice(0, targetIndex).filter(previousLabel => previousLabel === label).length;
    return totals[`${label}_${occurrence}`] ?? totals[label] ?? 0;
  };
  const valueAfter = (anchor: string, label: string): number => {
    const anchorIndex = lm[anchor];
    if (anchorIndex === undefined) return 0;
    for (let index = anchorIndex + 1; index < labels.length; index += 1) {
      if (labels[index] === label) return totalAtLabelIndex(index, label);
    }
    return 0;
  };

  // QB: CMP ATT YDS CMP% AVG TD INT LNG SACK RTG QBR | CAR YDS AVG TD LNG
  if ("CMP" in lm) {
    r.passCmp    = totals["CMP"] ?? 0;
    r.passAtt    = totals["ATT"] ?? 0;
    r.passYds    = valueAfter("CMP", "YDS");
    r.passTD     = valueAfter("CMP", "TD");
    r.passInt    = totals["INT"] ?? 0;
    r.passCmpPct = r.passAtt > 0 ? Math.round((r.passCmp / r.passAtt) * 1000) / 10 : 0;
    // Rush stats (second YDS/TD occurrence for QB)
    r.rushAtt    = totals["CAR"] ?? 0;
    r.rushYds    = valueAfter("CAR", "YDS");
    r.rushTD     = valueAfter("CAR", "TD");
    r.rushAvg    = r.rushAtt > 0 ? Math.round((r.rushYds / r.rushAtt) * 10) / 10 : 0;
  }

  // Rushing may follow receiving (RB/TE) or stand alone.
  if ("CAR" in lm && !("CMP" in lm)) {
    r.rushAtt    = totals["CAR"] ?? 0;
    r.rushYds    = valueAfter("CAR", "YDS");
    r.rushTD     = valueAfter("CAR", "TD");
    r.rushAvg    = r.rushAtt > 0 ? Math.round((r.rushYds / r.rushAtt) * 10) / 10 : 0;
  }

  // Receiving is the first stat group for WR/TE and follows rushing for RB.
  if ("REC" in lm) {
    r.rec        = totals["REC"] ?? 0;
    r.recTargets = totals["TGTS"] ?? 0;
    r.recYds     = valueAfter("REC", "YDS");
    r.recTD      = valueAfter("REC", "TD");
    r.recAvg     = r.rec > 0 ? Math.round((r.recYds / r.rec) * 10) / 10 : 0;
    r.fumblesLost = totals["LST"] ?? 0;
  }

  // K: FGM FGA FG% XPM XPA XP%
  if ("FGM" in lm) {
    r.fgMade  = totals["FGM"] ?? 0;
    r.fgAtt   = totals["FGA"] ?? 0;
    r.fgPct   = r.fgAtt > 0 ? Math.round((r.fgMade / r.fgAtt) * 1000) / 10 : 0;
    r.xpMade  = totals["XPM"] ?? 0;
    r.xpAtt   = totals["XPA"] ?? 0;
  }

  // DST: SACK INT FR TD
  if ("SACK" in lm && !("CMP" in lm)) {
    r.sacks            = totals["SACK"] ?? 0;
    r.defInt           = totals["INT"] ?? 0;
    r.fumblesRecovered = totals["FR"] ?? 0;
    r.defTD            = totals["TD"] ?? 0;
  }

  return r;
}

type ESPNGameEvent = { eventId?: string; stats?: string[] };
type ESPNEventMetadata = Record<string, { team?: { abbreviation?: string } }>;
type ESPNSeasonStatistic = { teamId?: string; displayName?: string; season?: { year?: number }; stats?: string[] };
type ESPNStatsCategory = { name?: string; labels?: string[]; statistics?: ESPNSeasonStatistic[] };
type ESPNTeamMetadata = Record<string, { id?: string; abbreviation?: string }>;

export function getPrimarySeasonTeam(events: ESPNGameEvent[], eventMetadata: ESPNEventMetadata): string | undefined {
  const teamCounts = new Map<string, number>();
  events.forEach(event => {
    const team = event.eventId ? eventMetadata[event.eventId]?.team?.abbreviation : undefined;
    if (team) teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
  });
  return Array.from(teamCounts.entries()).sort(([, firstCount], [, secondCount]) => secondCount - firstCount)[0]?.[0];
}

function numericStat(stats: string[] | undefined, labels: string[] | undefined, label: string): number {
  const index = labels?.indexOf(label) ?? -1;
  return index >= 0 ? Number.parseFloat((stats?.[index] ?? "0").replace(/,/g, "")) || 0 : 0;
}

function categoryFor(categories: ESPNStatsCategory[], name: string): ESPNStatsCategory | undefined {
  return categories.find(category => category.name === name);
}

function totalEntryFor(category: ESPNStatsCategory | undefined, year: number): ESPNSeasonStatistic | undefined {
  const entries = category?.statistics?.filter(entry => entry.season?.year === year) ?? [];
  return entries.find(entry => /totals/i.test(entry.displayName ?? "")) ?? entries[0];
}

export function extractFromSeasonTotals(categories: ESPNStatsCategory[], teams: ESPNTeamMetadata, year: number): Partial<SeasonStatRow> | null {
  const passing = categoryFor(categories, "passing");
  const rushing = categoryFor(categories, "rushing");
  const receiving = categoryFor(categories, "receiving");
  const kicking = categoryFor(categories, "kicking");
  const defensive = categoryFor(categories, "defensive");
  const fumbles = categoryFor(categories, "fumbles");
  const primaryCategory = receiving ?? rushing ?? passing ?? kicking ?? defensive;
  const primary = totalEntryFor(primaryCategory, year);
  if (!primary) return null;

  const teamEntries = (primaryCategory?.statistics ?? []).filter(entry => entry.season?.year === year && !/totals/i.test(entry.displayName ?? ""));
  const primaryTeamEntry = [...teamEntries].sort((left, right) => numericStat(right.stats, primaryCategory?.labels, "GP") - numericStat(left.stats, primaryCategory?.labels, "GP"))[0];
  const team = Object.values(teams).find(candidate => candidate.id === primaryTeamEntry?.teamId)?.abbreviation;
  const passEntry = totalEntryFor(passing, year);
  const rushEntry = totalEntryFor(rushing, year);
  const recEntry = totalEntryFor(receiving, year);
  const kickEntry = totalEntryFor(kicking, year);
  const defenseEntry = totalEntryFor(defensive, year);
  const fumbleEntry = totalEntryFor(fumbles, year);
  const rushAtt = numericStat(rushEntry?.stats, rushing?.labels, "CAR");
  const rushYds = numericStat(rushEntry?.stats, rushing?.labels, "YDS");
  const receptions = numericStat(recEntry?.stats, receiving?.labels, "REC");
  const recYds = numericStat(recEntry?.stats, receiving?.labels, "YDS");
  const fgIndex = kicking?.labels?.indexOf("FG") ?? -1;
  const [fgMade = "0", fgAtt = "0"] = fgIndex >= 0 ? (kickEntry?.stats?.[fgIndex] ?? "0-0").split("-") : ["0", "0"];

  return {
    gp: numericStat(primary.stats, primaryCategory?.labels, "GP"), team,
    passCmp: numericStat(passEntry?.stats, passing?.labels, "CMP"), passAtt: numericStat(passEntry?.stats, passing?.labels, "ATT"),
    passYds: numericStat(passEntry?.stats, passing?.labels, "YDS"), passTD: numericStat(passEntry?.stats, passing?.labels, "TD"), passInt: numericStat(passEntry?.stats, passing?.labels, "INT"),
    rushAtt, rushYds, rushTD: numericStat(rushEntry?.stats, rushing?.labels, "TD"), rushAvg: rushAtt > 0 ? Math.round((rushYds / rushAtt) * 10) / 10 : 0,
    rec: receptions, recTargets: numericStat(recEntry?.stats, receiving?.labels, "TGTS"), recYds, recTD: numericStat(recEntry?.stats, receiving?.labels, "TD"), recAvg: receptions > 0 ? Math.round((recYds / receptions) * 10) / 10 : 0,
    fgMade: Number.parseInt(fgMade, 10) || 0, fgAtt: Number.parseInt(fgAtt, 10) || 0,
    xpMade: numericStat(kickEntry?.stats, kicking?.labels, "XPM"), xpAtt: numericStat(kickEntry?.stats, kicking?.labels, "XPA"),
    sacks: numericStat(defenseEntry?.stats, defensive?.labels, "SACK"), defInt: numericStat(defenseEntry?.stats, defensive?.labels, "INT"),
    fumblesRecovered: numericStat(defenseEntry?.stats, defensive?.labels, "FR"), defTD: numericStat(defenseEntry?.stats, defensive?.labels, "TD"),
    fumblesLost: numericStat(fumbleEntry?.stats, fumbles?.labels, "LST"),
  };
}

function calculateSeasonRow(year: number, pos: string, extracted: Partial<SeasonStatRow>): SeasonStatRow {
  const gp = extracted.gp ?? 0;
  const tank01Stats = {
    Passing: { passYds: extracted.passYds ?? 0, passTD: extracted.passTD ?? 0, int: extracted.passInt ?? 0, passAtt: extracted.passAtt ?? 0, passCmp: extracted.passCmp ?? 0 },
    Rushing: { rushYds: extracted.rushYds ?? 0, rushTD: extracted.rushTD ?? 0, carries: extracted.rushAtt ?? 0 },
    Receiving: { recYds: extracted.recYds ?? 0, recTD: extracted.recTD ?? 0, receptions: extracted.rec ?? 0, targets: extracted.recTargets ?? 0 },
    Kicking: { fgMade: extracted.fgMade ?? 0, fgAttempts: extracted.fgAtt ?? 0, xpMade: extracted.xpMade ?? 0 },
    Defense: { sacks: extracted.sacks ?? 0, defensiveInterceptions: extracted.defInt ?? 0, defTD: extracted.defTD ?? 0, fumblesRecovered: extracted.fumblesRecovered ?? 0 },
    Fumbles: { fumblesLost: extracted.fumblesLost ?? 0 },
  };
  const wrcPts = calcFantasyPoints(tank01Stats as Parameters<typeof calcFantasyPoints>[0], pos, true);
  return { season: year, gp, ...extracted, wrcPts: Math.round(wrcPts * 10) / 10, wrcPtsPerGame: gp > 0 ? Math.round((wrcPts / gp) * 10) / 10 : 0 };
}

async function fetchSeasonStats(
  espnId: string,
  year: number,
  pos: string
): Promise<SeasonStatRow | null> {
  const cacheKey = `${CACHE_PREFIX}${espnId}_${year}`;
  try {
    clearObsoleteHistoryCaches(sessionStorage);
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    }
  } catch {}

  try {
    const res = await fetch(`${ESPN_GAMELOG}/${espnId}/gamelog?season=${year}`);
    if (!res.ok) return null;
    const d = await res.json();

    const labels: string[] = d.labels ?? [];
    if (!labels.length) {
      const fallbackResponse = await fetch(`${ESPN_GAMELOG}/${espnId}/stats?season=${year}`);
      if (!fallbackResponse.ok) return null;
      const fallbackData = await fallbackResponse.json();
      const fallback = extractFromSeasonTotals(fallbackData.categories ?? [], fallbackData.teams ?? {}, year);
      if (!fallback) return null;
      const row = calculateSeasonRow(year, pos, fallback);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: row })); } catch {}
      return row;
    }

    // Find regular season events (seasonTypes[1] or the one with most events)
    const seasonTypes: Array<{ categories?: Array<{ events?: ESPNGameEvent[] }> }> = d.seasonTypes ?? [];
    let regularEvents: ESPNGameEvent[] = [];
    for (const st of seasonTypes) {
      for (const cat of st.categories ?? []) {
        const evs = cat.events ?? [];
        if (evs.length > regularEvents.length) regularEvents = evs;
      }
    }

    if (!regularEvents.length) return null;

    const gp = regularEvents.length;
    const lm = buildLabelMap(labels);
    const totals = sumGameStats(regularEvents, Object.fromEntries(Object.entries(lm).map(([k, v]) => [k, v])));
    const extracted = extractFromGamelog(totals, gp, labels);

    const row = calculateSeasonRow(year, pos, { ...extracted, team: getPrimarySeasonTeam(regularEvents, d.events ?? {}) });

    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: row })); } catch {}
    return row;
  } catch (e) {
    console.error(`ESPN gamelog fetch failed for ${espnId} ${year}:`, e);
    return null;
  }
}

export function useESPNSeasonStats(
  espnId: string | null | undefined,
  pos: string
): UseESPNSeasonStatsResult {
  const [seasons, setSeasons] = useState<SeasonStatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!espnId) return;
    setLoading(true);
    setError(null);

    const years = [2025, 2024, 2023, 2022, 2021, 2020];
    Promise.all(years.map(yr => fetchSeasonStats(espnId, yr, pos)))
      .then(results => {
        const valid = results.filter((r): r is SeasonStatRow => r !== null);
        setSeasons(valid.sort((a, b) => b.season - a.season));
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [espnId, pos]);

  return { seasons, loading, error };
}
