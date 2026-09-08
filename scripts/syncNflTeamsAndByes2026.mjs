import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const TANK01_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const SEASON = 2026;
const APPLY = process.argv.includes("--apply");
const NFL_TEAMS = new Set([
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAC", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH",
]);
const TEAM_ALIASES = new Map([
  ["JAX", "JAC"], ["WAS", "WSH"], ["WS", "WSH"], ["LA", "LAR"], ["STL", "LAR"], ["SD", "LAC"], ["OAK", "LV"],
]);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
if (!process.env.TANK01_API_KEY) throw new Error("TANK01_API_KEY is not configured");

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeTeam(value) {
  const upper = String(value ?? "").trim().toUpperCase();
  return TEAM_ALIASES.get(upper) ?? upper;
}

function normalizePosition(value) {
  const upper = String(value ?? "").toUpperCase().replace(/\s/g, "");
  if (["PK", "KICKER"].includes(upper)) return "K";
  if (["D/ST", "DST", "DEF"].includes(upper)) return "DST";
  return upper;
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const NAME_ALIASES = new Map([
  ["kennethgainwell", "kennygainwell"],
  ["chigoziemokonkwo", "chigokonkwo"],
]);

function canonicalName(value) {
  const normalized = normalizeName(value);
  return NAME_ALIASES.get(normalized) ?? normalized;
}

function isFreeAgent(record) {
  return record?.isFreeAgent === true || String(record?.isFreeAgent ?? "").toLowerCase() === "true";
}

async function tankFetch(endpoint, params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetch(`https://${TANK01_HOST}/${endpoint}?${query.toString()}`, {
    headers: {
      "x-rapidapi-key": process.env.TANK01_API_KEY,
      "x-rapidapi-host": TANK01_HOST,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Tank01 ${endpoint} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function choosePlayerMatch(player, candidates) {
  if (candidates.length === 1) return candidates[0];
  const storedTeam = normalizeTeam(player.nfl_team);
  const teamMatched = candidates.filter(candidate => normalizeTeam(candidate.team) === storedTeam);
  if (teamMatched.length === 1) return teamMatched[0];
  return null;
}

async function loadByeWeeks(teams) {
  const entries = await Promise.all(
    [...teams].sort().map(async team => {
      const requestTeam = team === "JAC" ? "JAX" : team;
      const payload = await tankFetch("getNFLTeamSchedule", { teamAbv: requestTeam, season: String(SEASON) });
      const games = Array.isArray(payload?.body?.schedule) ? payload.body.schedule : [];
      const regularWeeks = new Set(
        games
          .filter(game => game?.seasonType === "Regular Season")
          .map(game => Number(String(game?.gameWeek ?? "").match(/Week\s+(\d+)/i)?.[1]))
          .filter(Number.isInteger),
      );
      const byeWeeks = Array.from({ length: 18 }, (_, index) => index + 1).filter(week => !regularWeeks.has(week));
      if (byeWeeks.length !== 1) {
        throw new Error(`Could not determine exactly one ${SEASON} bye week for ${team}; found ${byeWeeks.join(", ") || "none"}`);
      }
      return [team, byeWeeks[0]];
    }),
  );
  return new Map(entries);
}

const [{ data: players, error: playerError }, playerPayload] = await Promise.all([
  supabase.from("players").select("id,name,position,nfl_team,bye_week"),
  tankFetch("getNFLPlayerList"),
]);

if (playerError) throw new Error(`Supabase player read failed: ${playerError.message}`);
const tankPlayers = Array.isArray(playerPayload?.body) ? playerPayload.body : [];
if (!tankPlayers.length) throw new Error("Tank01 returned no players");

const providerByIdentity = new Map();
for (const player of tankPlayers) {
  const position = normalizePosition(player?.pos);
  const team = normalizeTeam(player?.team);
  if (!canonicalName(player?.longName) || !position) continue;
  const key = `${canonicalName(player.longName)}|${position}`;
  const list = providerByIdentity.get(key) ?? [];
  list.push({ ...player, team });
  providerByIdentity.set(key, list);
}

const resolved = [];
const unmatched = [];
const ambiguous = [];
for (const player of players ?? []) {
  const position = normalizePosition(player.position);
  if (position === "DST") {
    resolved.push({ player, provider: null });
    continue;
  }
  const candidates = providerByIdentity.get(`${canonicalName(player.name)}|${position}`) ?? [];
  const provider = choosePlayerMatch(player, candidates);
  if (!provider) {
    (candidates.length ? ambiguous : unmatched).push(player);
    resolved.push({ player, provider: null });
    continue;
  }
  resolved.push({ player, provider });
}

const teamsToSchedule = new Set();
for (const { player, provider } of resolved) {
  const team = provider ? (isFreeAgent(provider) ? "FA" : normalizeTeam(provider.team)) : normalizeTeam(player.nfl_team);
  if (NFL_TEAMS.has(team)) teamsToSchedule.add(team);
}
const byeWeeksByTeam = await loadByeWeeks(teamsToSchedule);

const changes = resolved.map(({ player, provider }) => {
  const storedTeam = normalizeTeam(player.nfl_team);
  const providerTeam = provider ? (isFreeAgent(provider) ? "FA" : normalizeTeam(provider.team)) : storedTeam;
  const nextTeam = provider && (NFL_TEAMS.has(providerTeam) || providerTeam === "FA") ? providerTeam : storedTeam;
  const nextBye = NFL_TEAMS.has(nextTeam) ? byeWeeksByTeam.get(nextTeam) : 0;
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    fromTeam: storedTeam,
    toTeam: nextTeam,
    fromBye: Number(player.bye_week ?? 0),
    toBye: nextBye ?? Number(player.bye_week ?? 0),
    providerMatched: Boolean(provider),
  };
}).filter(change => change.fromTeam !== change.toTeam || change.fromBye !== change.toBye);

const teamChanges = changes.filter(change => change.fromTeam !== change.toTeam);
const byeChanges = changes.filter(change => change.fromBye !== change.toBye);
const bothChanges = changes.filter(change => change.fromTeam !== change.toTeam && change.fromBye !== change.toBye);

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  source: `Tank01 getNFLPlayerList and getNFLTeamSchedule (${SEASON})`,
  playersChecked: players?.length ?? 0,
  providerRecords: tankPlayers.length,
  providerMatches: resolved.filter(item => item.provider).length,
  unmatched: unmatched.map(player => `${player.name} (${player.position})`),
  ambiguous: ambiguous.map(player => `${player.name} (${player.position})`),
  teamAssignmentUpdates: teamChanges.length,
  byeWeekUpdates: byeChanges.length,
  combinedTeamAndByeUpdates: bothChanges.length,
  changes,
}, null, 2));

if (!APPLY) {
  console.log("Dry run complete. Re-run with --apply to write only the listed changes.");
  process.exit(0);
}

let applied = 0;
for (const change of changes) {
  const { error } = await supabase
    .from("players")
    .update({ nfl_team: change.toTeam, bye_week: change.toBye })
    .eq("id", change.id);
  if (error) throw new Error(`Failed to update ${change.name}: ${error.message}`);
  applied += 1;
}

console.log(JSON.stringify({ applied, teamAssignmentUpdates: teamChanges.length, byeWeekUpdates: byeChanges.length }, null, 2));
