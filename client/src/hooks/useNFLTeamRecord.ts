/**
 * useNFLTeamRecord — the current W-L(-T) record for one NFL team, from Tank01's
 * getNFLTeams. Used by the player card's D/ST hero. Cached 6 hours in
 * sessionStorage. Codes are matched after normalizing to the app's codes, so
 * "JAC" matches Tank01's "JAX".
 */
import { useState, useEffect } from "react";
import { normalizeNFLTeamCode } from "@shared/nflTeamCodes";

const BASE_URL = "/api/tank01";
const CACHE_KEY = "wrc_nfl_team_records_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface NFLTeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

type RecordMap = Record<string, NFLTeamRecord>;

function cacheGet(): RecordMap | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data as RecordMap;
  } catch { return null; }
}

function cacheSet(data: RecordMap) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
}

export function useNFLTeamRecord(teamCode: string | null | undefined): NFLTeamRecord | null {
  const [records, setRecords] = useState<RecordMap | null>(() => cacheGet());

  useEffect(() => {
    if (records) return;
    let cancelled = false;
    fetch(`${BASE_URL}/getNFLTeams`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const map: RecordMap = {};
        for (const t of (data?.body ?? []) as Record<string, string>[]) {
          const code = normalizeNFLTeamCode(t.teamAbv);
          map[code] = { wins: Number(t.wins ?? 0), losses: Number(t.loss ?? 0), ties: Number(t.tie ?? 0) };
        }
        cacheSet(map);
        setRecords(map);
      })
      .catch(() => { /* record is optional; leave null */ });
    return () => { cancelled = true; };
  }, [records]);

  if (!teamCode || !records) return null;
  return records[normalizeNFLTeamCode(teamCode)] ?? null;
}
