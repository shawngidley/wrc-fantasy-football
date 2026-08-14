import { SCHEDULE_2026 } from "../client/src/lib/scheduleData2026";
import { supabaseAdmin } from "./supabaseAdmin";

const HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const n = (value: unknown) => Number.parseFloat(String(value ?? "0")) || 0;
const teamCode = (value: string) => ({ jax: "JAC", jac: "JAC", was: "WSH", wsh: "WSH", kan: "KC", kc: "KC", tam: "TB", tb: "TB", arz: "ARI", ari: "ARI" }[value.toLowerCase()] ?? value.toUpperCase());

function playerPoints(stats: Record<string, unknown>, position: string) {
  const pass = (stats.Passing as Record<string, unknown>) ?? {};
  const rush = (stats.Rushing as Record<string, unknown>) ?? {};
  const receive = (stats.Receiving as Record<string, unknown>) ?? {};
  const kick = (stats.Kicking as Record<string, unknown>) ?? {};
  const defense = (stats.Defense as Record<string, unknown>) ?? {};
  let points = n(pass.passYds) * 0.04 + n(pass.passTD) * 4 - n(pass.int) * 3 + n(pass.passingTwoPointConversion ?? stats.twoPointConversion);
  points += n(rush.rushYds) * 0.1 + n(rush.rushTD) * 6 + n(rush.rushingTwoPointConversion) * 2;
  points += n(receive.receptions) * (position === "TE" ? 1.5 : 1) + n(receive.recYds) * 0.1 + n(receive.recTD) * 6 + n(receive.receivingTwoPointConversion) * 2;
  points -= n(defense.fumblesLost) * 3;
  if (position === "K" || position === "PK") points += n(kick.xpMade) + n(kick.fgYds) * 0.1 - n(kick.fgMissed) * 2 - n(kick.xpMissed) * 2;
  return Math.round(Math.max(points, 0) * 10) / 10;
}

function defensePoints(stats: Record<string, unknown>) {
  let points = n(stats.sacks) * 2 + n(stats.defensiveInterceptions) * 3 + n(stats.fumblesRecovered) * 3 + n(stats.defTD) * 6 + n(stats.returnTD) * 6 + n(stats.safeties) * 2 + n(stats.blockKick) * 2;
  const allowed = n(stats.ptsAgainst);
  points += allowed === 0 ? 10 : allowed <= 6 ? 7 : allowed <= 13 ? 4 : allowed <= 17 ? 1 : allowed <= 27 ? 0 : allowed <= 34 ? -1 : -4;
  return Math.round(Math.max(points, 0) * 10) / 10;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function finalizeWeeklyResultsFromTank(week: number, season: number) {
  const key = process.env.TANK01_API_KEY;
  if (!key) throw new Error("Tank01 API credential is unavailable.");
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": HOST };
  const gamesResponse = await fetch(`https://${HOST}/getNFLGamesForWeek?week=${week}&seasonType=Regular%20Season&season=${season}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!gamesResponse.ok) throw new Error(`Unable to load NFL games (${gamesResponse.status}).`);
  const games = ((await gamesResponse.json()).body ?? []) as Array<{ gameID: string; gameStatus?: string }>;
  if (!games.length || games.some(game => !/final/i.test(game.gameStatus ?? ""))) throw new Error("NFL games for this week are not all final yet.");

  const [{ data: lineups, error: lineupsError }, { data: players, error: playersError }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("lineups").select("team_id, player_name, is_bench").eq("week", week).eq("season", season),
    supabaseAdmin.from("players").select("name, position, nfl_team").eq("season", season),
    supabaseAdmin.from("teams").select("id, owner, name"),
  ]);
  if (lineupsError || playersError || teamsError || !teams) throw new Error("Unable to load saved lineups.");

  const individualScores: Record<string, number> = {};
  const dstScores: Record<string, number> = {};
  for (const game of games) {
    const response = await fetch(`https://${HOST}/getNFLBoxScore?gameID=${game.gameID}&fantasyPoints=true&twoPointConversions=2&passYards=.04&passTD=4&passInterceptions=-3&pointsPerReception=1&carries=0&rushYards=.1&rushTD=6&fumbles=-3&receivingYards=.1&receivingTD=6&targets=0&defTD=6&fgMade=0&fgYards=.1&xpMade=1`, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Unable to load an NFL box score.");
    const body = (await response.json()).body ?? {};
    Object.values(body.playerStats ?? {}).forEach((entry: any) => {
      if (entry.longName) individualScores[String(entry.longName).toLowerCase()] = playerPoints(entry, String(entry.pos ?? ""));
    });
    Object.entries(body.teamStats ?? {}).forEach(([code, stats]) => { dstScores[teamCode(code)] = defensePoints(stats as Record<string, unknown>); });
  }

  const playerMeta = new Map((players ?? []).map(player => [String(player.name).toLowerCase(), { position: String(player.position), nflTeam: String(player.nfl_team) }]));
  const teamScores = new Map<string, number>();
  for (const lineup of lineups ?? []) {
    if (lineup.is_bench) continue;
    const player = playerMeta.get(String(lineup.player_name).toLowerCase());
    if (!player) continue;
    const score = player.position === "DST" ? (dstScores[teamCode(player.nflTeam)] ?? 0) : (individualScores[String(lineup.player_name).toLowerCase()] ?? 0);
    teamScores.set(lineup.team_id, Math.round(((teamScores.get(lineup.team_id) ?? 0) + score) * 10) / 10);
  }

  const schedule = SCHEDULE_2026.find(entry => entry.week === week);
  if (!schedule) throw new Error(`No WRC schedule exists for week ${week}.`);
  const idByOwner = new Map(teams.map(team => [team.owner, team.id]));
  const leagueMedian = median(Array.from(teamScores.values()));
  for (const [homeOwner, awayOwner] of schedule.matchups) {
    const homeTeamId = idByOwner.get(homeOwner);
    const awayTeamId = idByOwner.get(awayOwner);
    if (!homeTeamId || !awayTeamId) throw new Error("WRC team mapping is incomplete.");
    const { error } = await supabaseAdmin.from("weekly_results").update({
      home_score: teamScores.get(homeTeamId) ?? 0,
      away_score: teamScores.get(awayTeamId) ?? 0,
      is_final: true,
      league_median: leagueMedian,
    }).eq("week", week).eq("season", season).eq("home_owner", homeOwner).eq("away_owner", awayOwner);
    if (error) throw new Error("Unable to save final weekly results.");
  }

  const { data: results, error: resultsError } = await supabaseAdmin.from("weekly_results")
    .select("week, home_team_id, away_team_id, home_score, away_score").eq("season", season).eq("is_final", true).order("week");
  const { data: standings, error: standingsError } = await supabaseAdmin.from("team_standings").select("team_id, division");
  if (resultsError || standingsError || !standings) throw new Error("Scores saved, but standings could not be recalculated.");
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
      if (outcome === "W") { total.wins++; total.h2h_wins++; if (divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id)) total.div_wins++; }
      if (outcome === "L") { total.losses++; total.h2h_losses++; if (divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id)) total.div_losses++; }
      if (outcome === "T") total.ties++;
      if (entry.score > weekMedian) total.median_wins++; else total.median_losses++;
      total.streak = total.streak.startsWith(outcome) ? `${outcome}${n(total.streak.slice(1)) + 1}` : `${outcome}1`;
    }));
  });
  const updates = await Promise.all(Array.from(totals.entries()).map(([teamId, value]) => supabaseAdmin.from("team_standings").update({ ...value, streak: value.streak || "—" }).eq("team_id", teamId)));
  if (updates.some(update => update.error)) throw new Error("Unable to update standings.");
  return { finalized: true, week, season, leagueMedian };
}
