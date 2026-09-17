import { SCHEDULE_2026 } from "../client/src/lib/scheduleData2026";
import { supabaseAdmin } from "./supabaseAdmin";
import { creditPrizeEarnings } from "./prizeEarnings";
import { normalizePlayerName } from "../shared/playerNameMatch";
import { calcFantasyPoints, type Tank01Stats } from "../shared/scoringEngine";
import { parseEspnKickerEvents, getKickerEventsForPlayer, calculateWrcKickerPoints, type KickerPlayEvent } from "../shared/espnKickerEvents";
import { resolveRosterPlayerForLineupEntry, type RosterPlayerRow } from "../shared/rosterPlayerResolution";
import { normalizeTankSeasonStats, type PlayerSeasonStats } from "../shared/playerSeasonStats";
import { getDraftUniversePlayerByName } from "../shared/draftPlayerUniverse";
import { CURRENT_DRAFT_PLAYER_UNIVERSE_2026 } from "../shared/currentDraftPlayerUniverse2026";

const HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const n = (value: unknown) => Number.parseFloat(String(value ?? "0")) || 0;
const teamCode = (value: string) => ({ jax: "JAC", jac: "JAC", was: "WSH", wsh: "WSH", kan: "KC", kc: "KC", tam: "TB", tb: "TB", arz: "ARI", ari: "ARI" }[value.toLowerCase()] ?? value.toUpperCase());

/**
 * Tank01's getNFLBoxScore response keys teamStats by the literal strings
 * "home" and "away", not by team abbreviation -- confirmed live via
 * console diagnostics: `{ away: {...}, home: {...} }`, no team code
 * anywhere in that object. This resolves a teamStats key back to the
 * actual team abbreviation for that specific game (using the home/away
 * fields already present on getNFLGamesForWeek's response), so DST
 * scores get stored under the real team code rather than the literal
 * string "home"/"away" -- which was never found by anything looking up
 * a real team code, meaning every DST always computed as 0 here.
 */
/**
 * Confirmed directly with Tank01: getNFLBoxScore's own gameStatus/
 * gameStatusCode fields ARE genuinely live (unlike getNFLGamesForWeek's
 * stale, once-daily-refreshed version, which is why a game that had
 * genuinely ended hours earlier once still showed "Scheduled" through
 * that endpoint). gameStatusCode is a clean numeric enum (0=not started,
 * 1=in progress, 2=final/completed, 3=postponed, 4=suspended), checked
 * as a string here since its exact wire type isn't confirmed; falls back
 * to the gameStatus text itself for defense-in-depth in case that field
 * is ever missing or an unexpected type.
 */
export function isGameFinal(body: { gameStatus?: unknown; gameStatusCode?: unknown } | null | undefined): boolean {
  const code = body?.gameStatusCode !== undefined ? String(body.gameStatusCode) : undefined;
  if (code !== undefined) return code === "2";
  return /final|completed/i.test(String(body?.gameStatus ?? ""));
}

/**
 * Confirmed with the commissioner: each week, a team's main win/loss
 * record moves by up to 3 results total, combining two independent
 * outcomes -- winning head-to-head is worth 2 wins (losing is 2
 * losses), and beating the league median that week is worth 1
 * additional win (below median is 1 additional loss). A tie
 * head-to-head contributes neither wins nor losses from that
 * component. So the full range across a week is 0-3 wins and 0-3
 * losses, depending on the combination: win both (3-0), win
 * head-to-head only (2-1), win median only (1-2), or lose both (0-3).
 */
export function weeklyRecordDelta(h2hOutcome: "W" | "L" | "T", beatMedian: boolean): { winsDelta: number; lossesDelta: number } {
  let winsDelta = 0;
  let lossesDelta = 0;
  if (h2hOutcome === "W") winsDelta += 2;
  if (h2hOutcome === "L") lossesDelta += 2;
  if (beatMedian) winsDelta += 1; else lossesDelta += 1;
  return { winsDelta, lossesDelta };
}

/**
 * Fetches this game's ESPN play-by-play and parses it for kicker events
 * (made/missed FGs with exact yardage, made/missed XPs), mirroring the
 * exact same flow the client's live-scoring display uses -- find this
 * game on ESPN's scoreboard for its date by matching home/away team
 * codes, then fetch its full summary. Needed because Tank01's box score
 * only gives aggregate FG counts, not each kick's distance, and WRC's
 * FG scoring is distance-based (0.1/yard + bonus for 60+/65+) --
 * confirmed live that the previous Tank01-only fallback silently scored
 * 0 for every made FG whenever Tank01's aggregate fgYds field came back
 * empty, which is routinely the case.
 *
 * Returns an empty array (rather than throwing) if the game can't be
 * found on ESPN's scoreboard or its summary can't be fetched, so a
 * transient ESPN issue degrades to the old Tank01-based fallback for
 * kicker scoring rather than blocking the whole week's finalization.
 */
async function fetchEspnKickerEventsForGame(game: { gameID: string; home?: string; away?: string }): Promise<KickerPlayEvent[]> {
  const date = game.gameID.split("_")[0]; // gameID format: "20260914_DEN@KC" -- first segment is YYYYMMDD
  if (!date) return [];
  try {
    const scoreboardResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`, { signal: AbortSignal.timeout(15_000) });
    if (!scoreboardResponse.ok) return [];
    const scoreboard = await scoreboardResponse.json() as { events?: Array<{ id?: string; competitions?: Array<{ competitors?: Array<{ homeAway?: string; team?: { abbreviation?: string } }> }> }> };
    const event = scoreboard.events?.find(candidate => {
      const competitors = candidate.competitions?.[0]?.competitors ?? [];
      const home = competitors.find(item => item.homeAway === "home")?.team?.abbreviation;
      const away = competitors.find(item => item.homeAway === "away")?.team?.abbreviation;
      return home && away && teamCode(home) === teamCode(game.home ?? "") && teamCode(away) === teamCode(game.away ?? "");
    });
    if (!event?.id) return [];
    const summaryResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.id}`, { signal: AbortSignal.timeout(15_000) });
    if (!summaryResponse.ok) return [];
    return parseEspnKickerEvents(await summaryResponse.json());
  } catch {
    return [];
  }
}

export function resolveTeamStatsKey(homeAway: string, game: { home?: string; away?: string }): string | undefined {
  if (homeAway === "home") return game.home ? teamCode(game.home) : undefined;
  if (homeAway === "away") return game.away ? teamCode(game.away) : undefined;
  return undefined;
}

export interface WeeklyStatRowInput {
  name: string;
  position: string;
  nflTeam: string;
  statLine: PlayerSeasonStats | undefined;
}

/**
 * Merges two sources of players into one set of weekly-stat rows to
 * persist: every rostered player (from WRC's own players table,
 * guaranteed a row even if they didn't play this week -- position/team
 * come from WRC's own data) plus every free agent who actually played
 * this week but isn't on any fantasy roster (position/team come from
 * the shared draft player universe, since they have no players-table
 * row of their own; skipped entirely if the universe doesn't recognize
 * the name, rather than persisting a guessed position/team). A player
 * covered by the first group is never duplicated by the second, even
 * if they also appear in individualStatLines/dstStatLines.
 */
export function buildWeeklyStatRowInputs(
  rosterPlayers: RosterPlayerRow[],
  individualStatLines: Record<string, PlayerSeasonStats>,
  dstStatLines: Record<string, PlayerSeasonStats>,
): Map<string, WeeklyStatRowInput> {
  const rowInputsByName = new Map<string, WeeklyStatRowInput>();
  for (const player of rosterPlayers.filter(p => p.team_id)) {
    const statLine = player.position === "DST"
      ? dstStatLines[teamCode(player.nfl_team)]
      : individualStatLines[normalizePlayerName(player.name)];
    rowInputsByName.set(normalizePlayerName(player.name), { name: player.name, position: player.position, nflTeam: player.nfl_team, statLine });
  }
  for (const normalizedName of Object.keys(individualStatLines)) {
    if (rowInputsByName.has(normalizedName)) continue; // already covered as a rostered player above
    const universePlayer = getDraftUniversePlayerByName(normalizedName);
    if (!universePlayer) continue; // no reliable position/team source for this name -- skip rather than persist a guess
    rowInputsByName.set(normalizedName, { name: universePlayer.name, position: universePlayer.pos, nflTeam: universePlayer.nflTeam, statLine: individualStatLines[normalizedName] });
  }
  for (const teamAbv of Object.keys(dstStatLines)) {
    const universePlayer = CURRENT_DRAFT_PLAYER_UNIVERSE_2026.find(p => p.pos === "DST" && p.nflTeam === teamAbv);
    if (!universePlayer) continue;
    const normalizedName = normalizePlayerName(universePlayer.name);
    if (rowInputsByName.has(normalizedName)) continue; // already covered as a rostered DST above
    rowInputsByName.set(normalizedName, { name: universePlayer.name, position: "DST", nflTeam: universePlayer.nflTeam, statLine: dstStatLines[teamAbv] });
  }
  return rowInputsByName;
}

/**
 * Builds one player's full row to upsert into player_weekly_stats.
 * gp is set explicitly here -- 1 if the player has a real statLine
 * (they had an actual box score entry this week), 0 otherwise -- since
 * a single game's raw Tank01 entry has no reliably-populated
 * games-played field of its own to trust.
 */
export function buildWeeklyStatRow(
  week: number,
  season: number,
  name: string,
  position: string,
  nflTeam: string,
  statLine: PlayerSeasonStats | undefined,
) {
  const zeroStatLine: PlayerSeasonStats = normalizeTankSeasonStats(undefined, position);
  const s = statLine ? { ...statLine, gp: 1 } : { ...zeroStatLine, gp: 0 };
  return {
    week, season,
    player_name: name, position, nfl_team: nflTeam,
    gp: s.gp,
    pass_cmp: s.passCmp, pass_att: s.passAtt, pass_yds: s.passYds, pass_td: s.passTD, pass_int: s.passInt, pass_rating: s.passRating,
    rush_att: s.rushAtt, rush_yds: s.rushYds, rush_td: s.rushTD,
    receptions: s.receptions, targets: s.targets, rec_yds: s.recYds, rec_td: s.recTD,
    fg_made: s.fgMade, fg_att: s.fgAtt, fg_yds: s.fgYds,
    fg_made_1_to_39: s.fgMade1To39, fg_made_40_to_49: s.fgMade40To49, fg_made_50_to_59: s.fgMade50To59, fg_made_60_plus: s.fgMade60Plus,
    xp_made: s.xpMade, xp_att: s.xpAtt,
    sacks: s.sacks, def_int: s.defInt, fumbles_recovered: s.fumblesRecovered, takeaways: s.takeaways,
    def_td: s.defTD, dst_td: s.dstTD, return_td: s.returnTD, safeties: s.safeties, block_kicks: s.blockKicks,
    pts_against: s.ptsAgainst, fumbles_lost: s.fumblesLost, wrc_pts: s.wrcPts,
  };
}

/**
 * Tank01's sacksAndYardsLost is framed from the OFFENSE's side -- it's
 * how many times THIS team's own offense was sacked, not how many sacks
 * this team's defense made. Confirmed against the actual box score: a
 * game where New England's own teamStats entry showed sacksAndYardsLost
 * "3-10", but New England's defense genuinely had only 2 sacks (Seattle's
 * offense was sacked 2 times) -- the "3" belonged to Seattle's defense
 * sacking New England's offense. So a team's own defensive sack credit
 * for fantasy scoring comes from the OPPONENT's teamStats entry, not this
 * team's own -- all other defensive categories (interceptions, fumbles
 * recovered, defensive TDs, safeties) are already correctly framed from
 * this team's own defensive perspective and don't need this swap.
 */
/**
 * Tank01's team-level fumblesLost (like sacksAndYardsLost above) is
 * framed from the OFFENSE's side -- it's how many times THIS team's own
 * offense lost a fumble, not how many fumbles this team's defense
 * recovered. Confirmed live: Detroit's DST had no fumblesRecovered
 * field in the raw data at all, only fumblesLost: "1" under Detroit's
 * own entry, representing Detroit's own offense losing a fumble. A
 * defense's fumble-recovery credit needs to come from the OPPONENT's
 * fumblesLost value instead, exactly mirroring the sacks attribution.
 */
export function attributeOffenseFramedDefenseStats(
  homeAway: string,
  stats: Record<string, unknown>,
  teamStatsBody: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const opponentStats = teamStatsBody[homeAway === "home" ? "away" : "home"];
  return {
    ...stats,
    sacksAndYardsLost: opponentStats?.sacksAndYardsLost,
    sacks: opponentStats?.sacks,
    fumblesRecovered: opponentStats?.fumblesLost,
  };
}

// The actual scoring formula (including sacksFrom) now lives in
// shared/scoringEngine.ts, used identically by both this server-side
// official finalization path and the client's live-scoring display --
// confirmed live that these two paths had drifted apart (a missing
// return-TD credit, a narrower fumbles-lost field check, a different
// DST touchdown field check, on top of the earlier name-normalization
// bug), each independently causing the official score to differ from
// what Live Scoring actually showed for the same roster. sacksFrom is
// re-exported directly since it's still imported by this file's own
// tests; playerPoints and defensePoints keep their existing names and
// signatures (thin wrappers around the shared formula) so every other
// call site in this file didn't need to change.
export { sacksFrom } from "../shared/scoringEngine";

export function playerPoints(stats: Record<string, unknown>, position: string) {
  return calcFantasyPoints(stats as Tank01Stats, position);
}

export function defensePoints(stats: Record<string, unknown>) {
  return calcFantasyPoints({ Defense: stats } as Tank01Stats, "DST");
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Runs an async mapper over items with at most `limit` in flight at once,
 * rather than either fully sequential (slow, risks a function timeout for
 * a full week's worth of games) or fully parallel (risks overwhelming the
 * upstream API with a burst of simultaneous requests). Duplicated from the
 * same pattern in routers.ts rather than imported, since routers.ts itself
 * imports from this file and importing back would create a circular
 * dependency. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** money_owed.id is the owner's first name (plus last initial where
 * needed), lowercased with spaces/punctuation stripped -- e.g. "Scott M."
 * -> "scottm". Matches the DEFAULT_OWNERS format already used in
 * Money.tsx. */
export function moneyOwedIdForOwner(owner: string): string {
  return owner.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function finalizeWeeklyResultsFromTank(week: number, season: number) {
  const key = process.env.TANK01_API_KEY;
  if (!key) throw new Error("Tank01 API credential is unavailable.");
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": HOST };
  // getNFLGamesForWeek is only used here for the list of which games belong
  // to this week -- that part (the schedule) is fine on Tank01's own daily
  // refresh cadence. Its own gameStatus field is NOT used for the
  // "is this week done" check below -- confirmed directly with Tank01 that
  // this specific endpoint is a reference/schedule endpoint only updated
  // once each morning, not live, which is exactly why a game that had
  // genuinely ended hours earlier still showed "Scheduled" here.
  const gamesResponse = await fetch(`https://${HOST}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!gamesResponse.ok) throw new Error(`Unable to load NFL games (${gamesResponse.status}).`);
  const games = ((await gamesResponse.json()).body ?? []) as Array<{ gameID: string; home?: string; away?: string }>;
  if (!games.length) throw new Error("No NFL games found for this week.");

  const [{ data: lineups, error: lineupsError }, { data: players, error: playersError }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("lineups").select("team_id, player_name, slot, is_bench").eq("week", week).eq("season", season),
    supabaseAdmin.from("players").select("name, position, nfl_team, team_id"),
    supabaseAdmin.from("teams").select("id, owner, name"),
  ]);
  if (lineupsError || playersError || teamsError || !teams) {
    // The single, generic "Unable to load saved lineups." message this
    // used to always throw doesn't distinguish which of these three
    // queries actually failed or why -- confirmed live, that message
    // fired with nothing else to go on. Surface the real underlying
    // Supabase error(s) instead.
    const details = [
      lineupsError ? `lineups: ${lineupsError.message}` : null,
      playersError ? `players: ${playersError.message}` : null,
      teamsError ? `teams: ${teamsError.message}` : null,
      !teams && !teamsError ? "teams: query returned no data" : null,
    ].filter(Boolean).join(" | ");
    throw new Error(`Unable to load saved lineups. ${details}`);
  }

  const individualScores: Record<string, number> = {};
  const dstScores: Record<string, number> = {};
  const individualStatLines: Record<string, PlayerSeasonStats> = {};
  const dstStatLines: Record<string, PlayerSeasonStats> = {};
  // Tank01's player-level box score stats have an empty position field
  // for every player (confirmed live for both T. McBride and D.
  // Goedert: raw pos=""), so playerPoints' TE-reception check was
  // always failing regardless of the player's real position -- silently
  // dropping WRC's 1.5/reception TE bonus from every TE's official,
  // recorded score. Use the roster's own, correct position instead,
  // matched via the same suffix-aware normalizer used everywhere else
  // in this codebase, since Tank01's longName can differ from the
  // roster's stored name by a generational suffix (e.g. "James Cook"
  // vs "James Cook III").
  const positionByName = new Map((players ?? []).map(p => [normalizePlayerName(p.name), p.position]));
  const boxScores = await mapWithConcurrency(games, 5, async game => {
    const [response, kickerEvents] = await Promise.all([
      fetch(`https://${HOST}/getNFLBoxScore?gameID=${game.gameID}&fantasyPoints=true&twoPointConversions=2&passYards=.04&passTD=4&passInterceptions=-3&pointsPerReception=1&carries=0&rushYards=.1&rushTD=6&fumbles=-3&receivingYards=.1&receivingTD=6&targets=0&defTD=6&fgMade=0&fgYards=.1&xpMade=1`, { headers, signal: AbortSignal.timeout(30_000) }),
      fetchEspnKickerEventsForGame(game),
    ]);
    if (!response.ok) throw new Error("Unable to load an NFL box score.");
    const body = (await response.json()).body ?? {};
    return { game, body, kickerEvents };
  });

  const notYetFinal = boxScores.filter(({ body }) => !isGameFinal(body));
  if (notYetFinal.length > 0) {
    // Logging just the pending game(s), not the whole week's games, makes
    // it quick to see what's actually still holding up finalization the
    // next time this comes up.
    console.log(`[weeklyResultsFinalize] week=${week} season=${season}: ${boxScores.length} games found, ${notYetFinal.length} not yet final:`, JSON.stringify(notYetFinal.map(({ game, body }) => ({ gameID: game.gameID, gameStatus: body?.gameStatus, gameStatusCode: body?.gameStatusCode }))));
    throw new Error("NFL games for this week are not all final yet.");
  }

  for (const { game, body, kickerEvents } of boxScores) {
    Object.values(body.playerStats ?? {}).forEach((entry: any) => {
      if (entry.longName) {
        const normalizedName = normalizePlayerName(String(entry.longName));
        const rosterPosition = positionByName.get(normalizedName) ?? String(entry.pos ?? "");
        const statLine = normalizeTankSeasonStats(entry as Tank01Stats, rosterPosition);
        if (rosterPosition === "K") {
          const playerEvents = getKickerEventsForPlayer(kickerEvents, String(entry.longName));
          const points = playerEvents.length > 0
            ? calculateWrcKickerPoints(playerEvents, entry as Tank01Stats)
            : playerPoints(entry, rosterPosition);
          individualScores[normalizedName] = points;
          individualStatLines[normalizedName] = { ...statLine, wrcPts: points };
        } else {
          const points = playerPoints(entry, rosterPosition);
          individualScores[normalizedName] = points;
          individualStatLines[normalizedName] = { ...statLine, wrcPts: points };
        }
      }
    });
    const teamStatsBody = (body.teamStats ?? {}) as Record<string, Record<string, unknown>>;
    Object.entries(teamStatsBody).forEach(([homeAway, stats]) => {
      const teamAbv = resolveTeamStatsKey(homeAway, game);
      if (!teamAbv) return;
      const attributedStats = attributeOffenseFramedDefenseStats(homeAway, stats, teamStatsBody);
      const points = defensePoints(attributedStats);
      dstScores[teamAbv] = points;
      dstStatLines[teamAbv] = { ...normalizeTankSeasonStats({ Defense: attributedStats } as Tank01Stats, "DST"), wrcPts: points };
    });
  }

  const playerByNormalizedName = new Map((players ?? []).map(player => [normalizePlayerName(player.name), player as RosterPlayerRow]));
  const emptyPlayerById = new Map<string, RosterPlayerRow>();
  const teamScores = new Map<string, number>();
  const idByOwnerForLog = new Map(teams.map(team => [team.id, team.owner]));
  for (const lineup of lineups ?? []) {
    if (lineup.is_bench) continue;
    const player = resolveRosterPlayerForLineupEntry(lineup, emptyPlayerById, playerByNormalizedName, (players ?? []) as RosterPlayerRow[]);
    if (!player) {
      console.log(`[weeklyResultsFinalize] ${idByOwnerForLog.get(lineup.team_id)}'s starter still not found in players table: "${lineup.player_name}" (slot=${lineup.slot})`);
      continue;
    }
    const score = player.position === "DST"
      ? (dstScores[teamCode(player.nfl_team)] ?? 0)
      : (individualScores[normalizePlayerName(String(lineup.player_name))] ?? 0);
    teamScores.set(lineup.team_id, Math.round(((teamScores.get(lineup.team_id) ?? 0) + score) * 10) / 10);
  }

  // Persist every rostered player's full weekly stat line, plus every
  // free agent who actually played this week -- so both the Lineup
  // page (rostered players, including those who didn't play) and the
  // Free Agents page (any player, rostered or not) can read season
  // stats directly from this table instead of independently
  // recomputing them from Tank01/ESPN on every page load. This costs
  // zero additional API calls: box scores already contain every NFL
  // player who played that week, rostered or not -- only the
  // persistence step was previously scoped to rostered players.
  const rowInputsByName = buildWeeklyStatRowInputs((players ?? []) as RosterPlayerRow[], individualStatLines, dstStatLines);
  const weeklyStatRows = Array.from(rowInputsByName.values()).map(({ name, position, nflTeam, statLine }) =>
    buildWeeklyStatRow(week, season, name, position, nflTeam, statLine)
  );
  if (weeklyStatRows.length > 0) {
    const { error: weeklyStatsError } = await supabaseAdmin.from("player_weekly_stats").upsert(weeklyStatRows, { onConflict: "week,season,player_name" });
    if (weeklyStatsError) console.log(`[weeklyResultsFinalize] Unable to persist player_weekly_stats: ${weeklyStatsError.message}`);
  }

  const schedule = SCHEDULE_2026.find(entry => entry.week === week);
  if (!schedule) throw new Error(`No WRC schedule exists for week ${week}.`);
  const idByOwner = new Map(teams.map(team => [team.owner, team.id]));
  const leagueMedian = median(Array.from(teamScores.values()));
  for (const [homeOwner, awayOwner] of schedule.matchups) {
    const homeTeamId = idByOwner.get(homeOwner);
    const awayTeamId = idByOwner.get(awayOwner);
    if (!homeTeamId || !awayTeamId) throw new Error("WRC team mapping is incomplete.");
    const homeScore = teamScores.get(homeTeamId) ?? 0;
    const awayScore = teamScores.get(awayTeamId) ?? 0;
    const { data: updatedRows, error } = await supabaseAdmin.from("weekly_results").update({
      home_score: homeScore,
      away_score: awayScore,
      is_final: true,
      league_median: leagueMedian,
    }).eq("week", week).eq("season", season).eq("home_owner", homeOwner).eq("away_owner", awayOwner).select("id");
    // Temporary diagnostic: Supabase's update() silently matches zero
    // rows with no error if the filter doesn't find anything -- which
    // would leave the old score untouched while still reporting
    // success. Logging the computed score alongside how many rows
    // actually got updated makes this distinguishable from an actual
    // scoring-logic bug.
    console.log(`[weeklyResultsFinalize] week=${week} ${homeOwner} vs ${awayOwner}: computed home=${homeScore} away=${awayScore}, rows updated=${(updatedRows ?? []).length}`);
    if (error) throw new Error("Unable to save final weekly results.");

    // Rivalry Game: either owner could have independently declared this
    // specific matchup as their one rivalry game for the season -- if
    // either did, the winner is paid $30 from the prize pool once,
    // regardless of whether one or both sides declared it. The credit
    // goes to the Rivalry Game column of the 2026 Earnings table. It
    // must never touch money_owed: that table is league fees only
    // (week 1, 2026 originally did a +/-30 fee swing there and had to be
    // reversed by hand).
    const { data: rivalryRows, error: rivalryError } = await supabaseAdmin
      .from("rivalry_games")
      .select("id")
      .eq("week", week)
      .eq("season", season)
      .eq("resolved", false)
      .or(`and(team_id.eq.${homeTeamId},opponent_team_id.eq.${awayTeamId}),and(team_id.eq.${awayTeamId},opponent_team_id.eq.${homeTeamId})`);
    if (rivalryError) throw new Error("Unable to check rivalry game status for this matchup.");
    if (rivalryRows && rivalryRows.length > 0) {
      const homeScore = teamScores.get(homeTeamId) ?? 0;
      const awayScore = teamScores.get(awayTeamId) ?? 0;
      if (homeScore !== awayScore) { // no payout on an exact tie
        const winnerOwner = homeScore > awayScore ? homeOwner : awayOwner;
        await creditPrizeEarnings(winnerOwner, "gow", season);
      }
      // Mark resolved regardless of whether a payout was actually applied
      // (e.g. an exact tie) -- either way this matchup's rivalry
      // declaration(s) have now been processed and must not be
      // reconsidered on a re-run.
      const { error: resolveError } = await supabaseAdmin.from("rivalry_games")
        .update({ resolved: true }).in("id", rivalryRows.map(row => row.id));
      if (resolveError) throw new Error("Rivalry game payout applied, but could not be marked resolved.");
    }
  }

  await recomputeStandingsFromFinalizedResults(season);
  return { finalized: true, week, season, leagueMedian };
}

/**
 * Recomputes every team's full-season wins/losses/points/streak from
 * every finalized (is_final=true) weekly_results row, and writes the
 * result to team_standings. Extracted as its own function so it can be
 * re-run on demand -- e.g. after a division correction or a scoring
 * rule change -- without needing a specific week to newly become
 * final. finalizeWeeklyResultsFromTank calls this at the end of
 * finalizing a given week; it can also be called directly to force a
 * full recalculation of already-finalized weeks.
 */
export async function recomputeStandingsFromFinalizedResults(season: number) {
  const { data: results, error: resultsError } = await supabaseAdmin.from("weekly_results")
    .select("week, home_team_id, away_team_id, home_score, away_score").eq("season", season).eq("is_final", true).order("week");
  const { data: standings, error: standingsError } = await supabaseAdmin.from("team_standings").select("team_id, division");
  if (resultsError || standingsError || !standings) throw new Error("Standings could not be recalculated.");
  const totals = new Map(standings.map(row => [row.team_id, { wins: 0, losses: 0, ties: 0, pts_for: 0, pts_against: 0, h2h_wins: 0, h2h_losses: 0, median_wins: 0, median_losses: 0, div_wins: 0, div_losses: 0, streak: "" }]));
  const divisionByTeam = new Map(standings.map(row => [row.team_id, row.division]));
  const weekGroups = new Map<number, typeof results>();
  for (const result of results ?? []) { const list = weekGroups.get(result.week) ?? []; list.push(result); weekGroups.set(result.week, list); }
  Array.from(weekGroups.values()).forEach(rows => {
    const weekMedian = median(rows.flatMap(row => [n(row.home_score), n(row.away_score)]));
    rows.forEach(row => [{ id: row.home_team_id, score: n(row.home_score), opp: n(row.away_score) }, { id: row.away_team_id, score: n(row.away_score), opp: n(row.home_score) }].forEach(entry => {
      const total = totals.get(entry.id); if (!total) return;
      const outcome = entry.score > entry.opp ? "W" : entry.score < entry.opp ? "L" : "T";
      total.pts_for += entry.score; total.pts_against += entry.opp;
      if (outcome === "W") { total.h2h_wins++; if (divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id)) total.div_wins++; }
      if (outcome === "L") { total.h2h_losses++; if (divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id)) total.div_losses++; }
      if (outcome === "T") total.ties++;
      const beatMedian = entry.score > weekMedian;
      if (beatMedian) total.median_wins++; else total.median_losses++;
      const { winsDelta, lossesDelta } = weeklyRecordDelta(outcome, beatMedian);
      total.wins += winsDelta;
      total.losses += lossesDelta;
      total.streak = total.streak.startsWith(outcome) ? `${outcome}${n(total.streak.slice(1)) + 1}` : `${outcome}1`;
    }));
  });
  const updates = await Promise.all(Array.from(totals.entries()).map(([teamId, value]) => supabaseAdmin.from("team_standings").update({ ...value, streak: value.streak || "—" }).eq("team_id", teamId)));
  if (updates.some(update => update.error)) throw new Error("Unable to update standings.");
  return { season, teamsUpdated: totals.size };
}
