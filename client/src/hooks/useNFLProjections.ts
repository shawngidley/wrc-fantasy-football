/**
 * useNFLProjections — fetches Tank01 weekly fantasy projections
 * Returns a map of playerName (lowercase) → projected WRC fantasy points
 * and dstTeamAbv (uppercase) → projected WRC fantasy points for DST.
 *
 * The hook applies WRC scoring rules on top of the raw Tank01 stat projections
 * so the projected points match what owners actually score in this league.
 *
 * Results are cached in sessionStorage for the session.
 */
import { useState, useEffect } from "react";

const TANK01_BASE_URL = "/api/tank01";

/** Projected WRC fantasy points for a single player/DST */
export interface ProjectionEntry {
  proj: number;
  pos: string;
  team: string;
  longName: string;
}

/** Map of lowercase player name → projection */
export type ProjectionMap = Record<string, ProjectionEntry>;

interface UseNFLProjectionsResult {
  projections: ProjectionMap;
  loading: boolean;
  error: string | null;
}

const CACHE_PREFIX = "wrc_nfl_proj_v2_";
const PROJECTION_NAME_ALIASES: Record<string, string> = {
  "kenneth gainwell": "kenny gainwell",
};

function normalizeProjectionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── NFL team abbreviation normalizer (handles KAN→KC, TAM→TB, ARZ→ARI, JAX→JAC) ──
function normalizeAbv(abv: string): string {
  const map: Record<string, string> = {
    kan: "kc",  kc: "kc",
    tam: "tb",  tb: "tb",
    arz: "ari", ari: "ari",
    jax: "jac", jac: "jac",
    was: "wsh", wsh: "wsh",
  };
  const lo = abv.toLowerCase();
  return (map[lo] ?? lo).toUpperCase();
}

// ── WRC scoring rules (mirrors scoringEngine.ts) ──────────────────────────────
function calcWRCProj(p: Record<string, unknown>, pos: string): number {
  let pts = 0;
  const n = (v: unknown) => parseFloat((v as string) ?? "0") || 0;

  // Passing
  const pass = (p.Passing as Record<string, string>) ?? {};
  pts += n(pass.passYds) * 0.04;
  pts += n(pass.passTD)  * 4;
  pts -= n(pass.int)     * 3;
  // passing 2-pt = 1 pt (per scoringEngine.ts line 104)
  pts += n(p.twoPointConversion as string) * 1;

  // Rushing
  const rush = (p.Rushing as Record<string, string>) ?? {};
  pts += n(rush.rushYds) * 0.1;
  pts += n(rush.rushTD)  * 6;

  // Receiving — TE gets 1.5x PPR
  const rec = (p.Receiving as Record<string, string>) ?? {};
  pts += pos === "TE" ? n(rec.receptions) * 1.5 : n(rec.receptions) * 1.0;
  pts += n(rec.recYds) * 0.1;
  pts += n(rec.recTD)  * 6;

  // Kicker: xpMade*1, fgMade*38*0.1 (estimated avg distance)
  if (pos === "K" || pos === "PK") {
    const kick = (p.Kicking as Record<string, string>) ?? {};
    pts += n(kick.xpMade)  * 1;
    pts += n(kick.fgMade)  * 38 * 0.1;
    pts -= n(kick.fgMissed) * 2;
    pts -= n(kick.xpMissed) * 2;
  }

  // Fumbles lost
  pts -= n(p.fumblesLost as string) * 3;

  return Math.max(0, Math.round(pts * 10) / 10);
}

function calcDSTProj(d: Record<string, string>): number {
  let pts = 0;
  const n = (v: string | undefined) => parseFloat(v ?? "0") || 0;
  pts += n(d.sacks)            * 2;
  pts += n(d.interceptions)    * 3;
  pts += n(d.fumbleRecoveries) * 3;
  pts += n(d.defTD)            * 6;
  pts += n(d.returnTD)         * 6;
  pts += n(d.safeties)         * 2;
  pts += n(d.blockKick)        * 2;
  return Math.max(0, Math.round(pts * 10) / 10);
}

export function useNFLProjections(week: number, season = 2026): UseNFLProjectionsResult {
  const [projections, setProjections] = useState<ProjectionMap>({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${CACHE_PREFIX}${season}_w${week}`;

    // Check sessionStorage cache
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setProjections(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch { /* ignore */ }

    let cancelled = false;

    async function fetchProjections() {
      try {
        setLoading(true);
        setError(null);

        const url = `${TANK01_BASE_URL}/getNFLProjections?week=${week}&season=${season}&seasonType=Regular%20Season`;
        const res = await fetch(url);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const body = data?.body ?? {};

        const map: ProjectionMap = {};

        // ── Player projections ─────────────────────────────────────────────
        const playerProj = body.playerProjections ?? {};
        for (const p of Object.values(playerProj) as Record<string, unknown>[]) {
          const name = (p.longName as string) ?? "";
          const pos  = (p.pos      as string) ?? "";
          const team = (p.team     as string) ?? "";
          if (!name) continue;
          const proj = calcWRCProj(p, pos);
          const entry = { proj, pos, team, longName: name };
          map[name.toLowerCase()] = entry;
          map[normalizeProjectionName(name)] = entry;
          for (const [displayName, canonicalName] of Object.entries(PROJECTION_NAME_ALIASES)) {
            if (canonicalName === name.toLowerCase()) {
              map[displayName] = entry;
              map[normalizeProjectionName(displayName)] = entry;
            }
          }
        }

        // ── DST projections — keyed by teamAbv (e.g. "BUF") ───────────────
        const dstProj = body.teamDefenseProjections ?? {};
        for (const d of Object.values(dstProj) as Record<string, string>[]) {
          const rawAbv = d.teamAbv ?? "";
          if (!rawAbv) continue;
          const abv  = normalizeAbv(rawAbv);
          const proj = calcDSTProj(d);
          map[`dst:${abv}`] = { proj, pos: "DST", team: abv, longName: abv };
        }

        if (!cancelled) {
          setProjections(map);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(map)); } catch { /* ignore */ }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load projections");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProjections();
    return () => { cancelled = true; };
  }, [week, season]);

  return { projections, loading, error };
}

/**
 * Look up a player's projected WRC points from the projection map.
 * For DST players, pass the NFL team abbreviation (e.g. "BUF").
 * For all others, pass the player's full name.
 */
export function getProjectedPoints(
  projections: ProjectionMap,
  playerName: string,
  pos: string,
  nflTeam: string
): number {
  if (pos === "DST") {
    const normAbv = normalizeAbv(nflTeam);
    const entry = projections[`dst:${normAbv}`];
    return entry?.proj ?? 0;
  }
  const rawName = playerName.toLowerCase();
  const canonicalName = PROJECTION_NAME_ALIASES[rawName] ?? rawName;
  const entry = projections[rawName] ?? projections[canonicalName] ?? projections[normalizeProjectionName(canonicalName)];
  return entry?.proj ?? 0;
}
