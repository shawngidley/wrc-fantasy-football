import { readFile } from "node:fs/promises";

const raw = await readFile("/tmp/tank_team_stats.json", "utf8");
const payload = JSON.parse(raw);
const teams = Array.isArray(payload.body) ? payload.body : [];

for (const abbreviation of ["TB", "GB"]) {
  const team = teams.find((entry) => entry.teamAbv === abbreviation);
  console.log(JSON.stringify({
    teamAbv: abbreviation,
    record: { wins: team?.wins, loss: team?.loss, tie: team?.tie },
    defense: team?.teamStats?.Defense,
  }, null, 2));
}
