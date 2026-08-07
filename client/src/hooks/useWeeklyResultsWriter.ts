/**
 * useWeeklyResultsWriter — auto-writes weekly fantasy results to Supabase
 * once the last NFL game of the week goes final.
 *
 * Logic:
 *  1. Determine the last game of the week from the matchupMap (latest kickoff + 4h)
 *  2. Once that window has passed, fetch all teams' saved lineups from `lineups`
 *  3. Fetch final box scores from Tank01 for all games that week
 *  4. Calculate each team's WRC fantasy score from their saved lineup
 *  5. Write scores to `weekly_results` and update `team_standings`
 *  6. Store a flag in sessionStorage so it only runs once per week
 *
 * This hook is designed to run silently in the background on any page that
 * imports it. It is idempotent — if results are already final it does nothing.
 *
 * Commissioner override: call `forceWriteResults(week)` to trigger manually.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_2026, OWNER_TO_TEAM } from "@/lib/scheduleData2026";
import { type NFLMatchupMap } from "@/hooks/useNFLMatchups";

const RAPIDAPI_KEY = "7e46b980d9mshee27c75e8b169f3p17558bjsnc4344991f4d3";
const RAPIDAPI_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";

// ── Owner → team_id (matches seed-standings.mjs) ─────────────────────────────
const OWNER_TO_TEAM_ID: Record<string, string> = {
  "Jonas":    "jonas",
  "David R.": "davidr",
  "Jason":    "jason",
  "Jamie":    "jamie",
  "Keith":    "keith",
  "Dan":      "dan",
  "Scott N.": "scottn",
  "Bill":     "bill",
  "Scott M.": "scottm",
  "David S.": "davids",
  "Shawn":    "shawn",
  "Greg":     "greg",
};

// Division lookup
const OWNER_DIVISION: Record<string, string> = {
  "Jonas":    "East",
  "David R.": "East",
  "Jason":    "East",
  "Jamie":    "East",
  "Keith":    "Central",
  "Dan":      "Central",
  "Scott N.": "Central",
  "Bill":     "Central",
  "Scott M.": "West",
  "David S.": "West",
  "Shawn":    "West",
  "Greg":     "West",
};

// ── NFL abbreviation normalizer ───────────────────────────────────────────────
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

// ── WRC scoring rules ─────────────────────────────────────────────────────────
function calcWRCFromStats(stats: Record<string, unknown>, pos: string): number {
  let pts = 0;
  const n = (v: unknown) => parseFloat((v as string) ?? "0") || 0;

  const pass = (stats.Passing as Record<string, string>) ?? {};
  pts += n(pass.passYds) * 0.04;
  pts += n(pass.passTD)  * 4;
  pts -= n(pass.int)     * 3;
  pts += n(pass.passingTwoPointConversion ?? stats.twoPointConversion) * 1;

  const rush = (stats.Rushing as Record<string, string>) ?? {};
  pts += n(rush.rushYds) * 0.1;
  pts += n(rush.rushTD)  * 6;
  pts += n(rush.rushingTwoPointConversion) * 2;

  const rec = (stats.Receiving as Record<string, string>) ?? {};
  pts += pos === "TE" ? n(rec.receptions) * 1.5 : n(rec.receptions) * 1.0;
  pts += n(rec.recYds) * 0.1;
  pts += n(rec.recTD)  * 6;
  pts += n(rec.receivingTwoPointConversion) * 2;

  if (pos === "K" || pos === "PK") {
    const kick = (stats.Kicking as Record<string, string>) ?? {};
    pts += n(kick.xpMade)   * 1;
    pts += n(kick.fgYds)    * 0.1;
    pts -= n(kick.fgMissed) * 2;
    pts -= n(kick.xpMissed) * 2;
  }

  pts -= n((stats.Defense as Record<string, string>)?.fumblesLost) * 3;
  return Math.round(Math.max(0, pts) * 10) / 10;
}

function calcDSTFromStats(d: Record<string, string>): number {
  let pts = 0;
  const n = (v: string | undefined) => parseFloat(v ?? "0") || 0;
  pts += n(d.sacks)                  * 2;
  pts += n(d.defensiveInterceptions) * 3;
  pts += n(d.fumblesRecovered)       * 3;
  pts += n(d.defTD)                  * 6;
  pts += n(d.returnTD)               * 6;
  pts += n(d.safeties)               * 2;
  pts += n(d.blockKick)              * 2;
  const pa = n(d.ptsAgainst);
  if (pa === 0)       pts += 10;
  else if (pa <= 6)   pts += 7;
  else if (pa <= 13)  pts += 4;
  else if (pa <= 17)  pts += 1;
  else if (pa <= 27)  pts += 0;
  else if (pa <= 34)  pts -= 1;
  else                pts -= 4;
  return Math.round(Math.max(0, pts) * 10) / 10;
}

// ── Streak helper ─────────────────────────────────────────────────────────────
function newStreak(current: string, won: boolean): string {
  const letter = won ? "W" : "L";
  const match = current?.match(/^([WL])(\d+)$/);
  if (match && match[1] === letter) return `${letter}${parseInt(match[2]) + 1}`;
  return `${letter}1`;
}

// ── Last game detection ───────────────────────────────────────────────────────
function isLastGameFinal(matchupMap: NFLMatchupMap): boolean {
  const now = Date.now();
  let latestEnd = 0;
  for (const m of Object.values(matchupMap)) {
    if (!m.gameDate || !m.gameTime) continue;
    const d = m.gameDate;
    const datePart = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    const timeMatch = m.gameTime.match(/(\d+):(\d+)([ap])/i);
    if (!timeMatch) continue;
    let hours = parseInt(timeMatch[1], 10);
    const mins  = parseInt(timeMatch[2], 10);
    const ampm  = timeMatch[3].toLowerCase();
    if (ampm === "p" && hours !== 12) hours += 12;
    if (ampm === "a" && hours === 12) hours = 0;
    const utcHours = hours + 4; // EDT offset
    const kickoff = new Date(`${datePart}T${String(utcHours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:00Z`).getTime();
    const end = kickoff + 4 * 60 * 60 * 1000; // +4h = final
    if (end > latestEnd) latestEnd = end;
  }
  return latestEnd > 0 && now > latestEnd;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
interface UseWeeklyResultsWriterResult {
  autoWriteStatus: "idle" | "running" | "done" | "error";
  autoWriteError: string | null;
  forceWriteResults: (week: number, season?: number) => Promise<void>;
}

export function useWeeklyResultsWriter(
  week: number,
  season: number,
  matchupMap: NFLMatchupMap,
  enabled = true
): UseWeeklyResultsWriterResult {
  const [autoWriteStatus, setAutoWriteStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [autoWriteError, setAutoWriteError] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  const writeResults = useCallback(async (w: number, s: number) => {
    const cacheKey = `wrc_results_written_${s}_w${w}`;
    if (sessionStorage.getItem(cacheKey)) {
      setAutoWriteStatus("done");
      return;
    }

    setAutoWriteStatus("running");
    setAutoWriteError(null);

    try {
      // 1. Check if weekly_results for this week are already final
      const { data: existingResults } = await supabase
        .from("weekly_results")
        .select("id, home_owner, away_owner, home_score, away_score, is_final")
        .eq("week", w)
        .eq("season", s);

      const allAlreadyFinal = existingResults?.every(r => r.is_final) ?? false;
      if (allAlreadyFinal && existingResults && existingResults.length > 0) {
        sessionStorage.setItem(cacheKey, "1");
        setAutoWriteStatus("done");
        return;
      }

      // 2. Load all teams' saved lineups for this week
      const { data: lineupRows } = await supabase
        .from("lineups")
        .select("team_id, slot, player_name, is_bench")
        .eq("week", w)
        .eq("season", s);

      // Group lineups by team_id → starters only (is_bench = false)
      const teamLineups: Record<string, { slot: string; playerName: string }[]> = {};
      for (const row of lineupRows ?? []) {
        if (row.is_bench) continue;
        if (!teamLineups[row.team_id]) teamLineups[row.team_id] = [];
        teamLineups[row.team_id].push({ slot: row.slot, playerName: row.player_name });
      }

      // 3. Fetch all game box scores for this week from Tank01
      const url = `https://${RAPIDAPI_HOST}/getNFLGamesForWeek?week=${w}&seasonType=Regular%20Season&season=${s}`;
      const gamesRes = await fetch(url, {
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      });
      if (!gamesRes.ok) throw new Error(`Tank01 games HTTP ${gamesRes.status}`);
      const gamesData = await gamesRes.json();
      const games = (gamesData?.body ?? []) as Array<{ gameID: string; gameStatus: string }>;

      // Fetch box scores for all games
      const playerScoreMap: Record<string, number> = {}; // lowercase name → pts
      const dstScoreMap: Record<string, number> = {};    // normalized abv → pts

      for (const game of games) {
        try {
          const bsUrl = `https://${RAPIDAPI_HOST}/getNFLBoxScore?gameID=${game.gameID}&fantasyPoints=true&twoPointConversions=2&passYards=.04&passTD=4&passInterceptions=-3&pointsPerReception=1&carries=0&rushYards=.1&rushTD=6&fumbles=-3&receivingYards=.1&receivingTD=6&targets=0&defTD=6&fgMade=0&fgYards=.1&xpMade=1`;
          const bsRes = await fetch(bsUrl, {
            headers: {
              "x-rapidapi-key": RAPIDAPI_KEY,
              "x-rapidapi-host": RAPIDAPI_HOST,
            },
          });
          if (!bsRes.ok) continue;
          const bsData = await bsRes.json();
          const body = bsData?.body ?? {};

          for (const p of Object.values(body.playerStats ?? {}) as Record<string, unknown>[]) {
            const name = (p.longName as string) ?? "";
            const pos  = (p.pos      as string) ?? "";
            if (!name) continue;
            playerScoreMap[name.toLowerCase()] = calcWRCFromStats(p, pos);
          }

          for (const [teamAbv, d] of Object.entries(body.teamStats ?? {}) as [string, Record<string, string>][]) {
            const normAbv = normalizeAbv(teamAbv);
            dstScoreMap[normAbv] = calcDSTFromStats(d);
          }
        } catch { /* skip failed box score */ }
      }

      // 4. Calculate each team's fantasy score from their saved lineup
      // We need the players table to know each player's position and NFL team
      const { data: allPlayers } = await supabase
        .from("players")
        .select("name, position, nfl_team")
        .eq("season", s);

      const playerMeta: Record<string, { pos: string; nflTeam: string }> = {};
      for (const p of allPlayers ?? []) {
        playerMeta[p.name.toLowerCase()] = { pos: p.position, nflTeam: p.nfl_team };
      }

      // Score each team
      const teamScores: Record<string, number> = {};
      for (const [teamId, starters] of Object.entries(teamLineups)) {
        let total = 0;
        for (const { playerName } of starters) {
          const meta = playerMeta[playerName.toLowerCase()];
          if (!meta) continue;
          if (meta.pos === "DST") {
            const normAbv = normalizeAbv(meta.nflTeam);
            total += dstScoreMap[normAbv] ?? 0;
          } else {
            total += playerScoreMap[playerName.toLowerCase()] ?? 0;
          }
        }
        teamScores[teamId] = Math.round(total * 10) / 10;
      }

      // 5. Get the WRC schedule matchups for this week
      const weekSchedule = SCHEDULE_2026.find(sw => sw.week === w);
      if (!weekSchedule) throw new Error(`No schedule found for week ${w}`);

      // 6. Compute league median from all team scores
      const allScores = Object.values(teamScores).filter(v => v > 0);
      const sorted = [...allScores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length === 0 ? 0
        : sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      // 7. Load current standings
      const { data: standings } = await supabase
        .from("team_standings")
        .select("*");

      const standingsByTeamId: Record<string, Record<string, unknown>> = {};
      for (const s of standings ?? []) {
        standingsByTeamId[(s as Record<string, string>).team_id] = s as Record<string, unknown>;
      }

      // 8. Write results and update standings for each matchup
      for (const [homeOwner, awayOwner] of weekSchedule.matchups) {
        const homeTeamId = OWNER_TO_TEAM_ID[homeOwner];
        const awayTeamId = OWNER_TO_TEAM_ID[awayOwner];
        const homeScore = teamScores[homeTeamId] ?? 0;
        const awayScore = teamScores[awayTeamId] ?? 0;

        // Update weekly_results row
        const { error: resErr } = await supabase
          .from("weekly_results")
          .update({
            home_score: homeScore,
            away_score: awayScore,
            is_final: true,
            league_median: median,
          })
          .eq("week", w)
          .eq("season", s)
          .eq("home_owner", homeOwner)
          .eq("away_owner", awayOwner);

        if (resErr) {
          console.warn(`Failed to update result for ${homeOwner} vs ${awayOwner}:`, resErr);
          continue;
        }

        // Update standings for both teams
        const homeS = standingsByTeamId[homeTeamId];
        const awayS = standingsByTeamId[awayTeamId];
        if (!homeS || !awayS) continue;

        const homeWon = homeScore > awayScore;
        const awayWon = awayScore > homeScore;
        const isDivGame = OWNER_DIVISION[homeOwner] === OWNER_DIVISION[awayOwner];

        const n = (v: unknown) => (v as number) ?? 0;

        const homeUpdate = {
          wins:          n(homeS.wins)          + (homeWon ? 1 : 0),
          losses:        n(homeS.losses)        + (awayWon ? 1 : 0),
          pts_for:       Math.round((n(homeS.pts_for)       + homeScore) * 10) / 10,
          pts_against:   Math.round((n(homeS.pts_against)   + awayScore) * 10) / 10,
          h2h_wins:      n(homeS.h2h_wins)      + (homeWon ? 1 : 0),
          h2h_losses:    n(homeS.h2h_losses)    + (awayWon ? 1 : 0),
          median_wins:   n(homeS.median_wins)   + (homeScore > median ? 1 : 0),
          median_losses: n(homeS.median_losses) + (homeScore <= median ? 1 : 0),
          div_wins:      n(homeS.div_wins)      + (isDivGame && homeWon ? 1 : 0),
          div_losses:    n(homeS.div_losses)    + (isDivGame && awayWon ? 1 : 0),
          streak:        newStreak(homeS.streak as string, homeWon),
        };

        const awayUpdate = {
          wins:          n(awayS.wins)          + (awayWon ? 1 : 0),
          losses:        n(awayS.losses)        + (homeWon ? 1 : 0),
          pts_for:       Math.round((n(awayS.pts_for)       + awayScore) * 10) / 10,
          pts_against:   Math.round((n(awayS.pts_against)   + homeScore) * 10) / 10,
          h2h_wins:      n(awayS.h2h_wins)      + (awayWon ? 1 : 0),
          h2h_losses:    n(awayS.h2h_losses)    + (homeWon ? 1 : 0),
          median_wins:   n(awayS.median_wins)   + (awayScore > median ? 1 : 0),
          median_losses: n(awayS.median_losses) + (awayScore <= median ? 1 : 0),
          div_wins:      n(awayS.div_wins)      + (isDivGame && awayWon ? 1 : 0),
          div_losses:    n(awayS.div_losses)    + (isDivGame && homeWon ? 1 : 0),
          streak:        newStreak(awayS.streak as string, awayWon),
        };

        await Promise.all([
          supabase.from("team_standings").update(homeUpdate).eq("team_id", homeTeamId),
          supabase.from("team_standings").update(awayUpdate).eq("team_id", awayTeamId),
        ]);
      }

      // 9. Write Game of the Week — highest-scoring team this week
      const TEAM_ID_TO_OWNER: Record<string, string> = Object.fromEntries(
        Object.entries(OWNER_TO_TEAM_ID).map(([owner, id]) => [id, owner])
      );
      const OWNER_TO_TEAM_NAME: Record<string, string> = {
        "Jonas":    "The Super Snuffleupagus",
        "David R.": "The Boys of Fall",
        "Jason":    "Heiden's Hardtimes",
        "Jamie":    "The Four Horsemen",
        "Keith":    "HamSandwich",
        "Dan":      "Larry \"Bud\" Melman123",
        "Scott N.": "Millertime",
        "Bill":     "Billy Goats Gruff",
        "Scott M.": "Xavier Musketeers",
        "David S.": "Legends",
        "Shawn":    "Vipers",
        "Greg":     "Larry \"Bud\" Melman123",
      };
      // Find the team with the highest score this week
      const gowEntry = Object.entries(teamScores).reduce<{ teamId: string; score: number } | null>(
        (best, [teamId, score]) => (!best || score > best.score) ? { teamId, score } : best,
        null
      );
      if (gowEntry) {
        const gowOwner = TEAM_ID_TO_OWNER[gowEntry.teamId] ?? gowEntry.teamId;
        const gowTeamName = OWNER_TO_TEAM_NAME[gowOwner] ?? gowOwner;
        // Find their opponent this week
        const gowMatchup = weekSchedule.matchups.find(
          ([h, a]) => OWNER_TO_TEAM_ID[h] === gowEntry.teamId || OWNER_TO_TEAM_ID[a] === gowEntry.teamId
        );
        const gowOppOwner = gowMatchup
          ? (OWNER_TO_TEAM_ID[gowMatchup[0]] === gowEntry.teamId ? gowMatchup[1] : gowMatchup[0])
          : "";
        const gowOppTeamName = OWNER_TO_TEAM_NAME[gowOppOwner] ?? gowOppOwner;
        const gowOppScore = teamScores[OWNER_TO_TEAM_ID[gowOppOwner]] ?? 0;
        await supabase.from("gow_history").upsert({
          week: w,
          season: s,
          winner: gowOwner,
          team: gowTeamName,
          opponent: gowOppTeamName,
          score: `${gowEntry.score.toFixed(1)} – ${gowOppScore.toFixed(1)}`,
          amount: 30,
        }, { onConflict: "week,season" });
      }

      sessionStorage.setItem(cacheKey, "1");
      setAutoWriteStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Auto-write failed";
      setAutoWriteError(msg);
      setAutoWriteStatus("error");
      console.error("useWeeklyResultsWriter error:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger: check every 5 minutes if the last game is final
  useEffect(() => {
    if (!enabled || hasRunRef.current) return;
    if (Object.keys(matchupMap).length === 0) return;

    if (isLastGameFinal(matchupMap)) {
      hasRunRef.current = true;
      writeResults(week, season);
      return;
    }

    // Poll every 5 minutes to check if the last game has ended
    const interval = setInterval(() => {
      if (isLastGameFinal(matchupMap)) {
        clearInterval(interval);
        if (!hasRunRef.current) {
          hasRunRef.current = true;
          writeResults(week, season);
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [week, season, matchupMap, enabled, writeResults]);

  const forceWriteResults = useCallback(async (w: number, s = 2026) => {
    hasRunRef.current = true;
    // Clear cache so force always runs
    sessionStorage.removeItem(`wrc_results_written_${s}_w${w}`);
    await writeResults(w, s);
  }, [writeResults]);

  return { autoWriteStatus, autoWriteError, forceWriteResults };
}
