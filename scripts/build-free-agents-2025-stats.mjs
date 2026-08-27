// Derives completed 2025 offensive player totals for the WRC season-stats
// cache, from the public nflverse play-by-play + roster releases (no Manus
// dependency). Ports scripts/build_free_agents_2025_stats.py to Node since no
// Python runtime is available here. Writes the result and (if Supabase
// service-role env vars are present) uploads it to the `site-assets` bucket
// under the exact key server/seasonStatsSnapshot.ts expects.
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";

const PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz";
const ROSTER_URL = "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2025.csv";
const PLAYERS_PATH = new URL("../shared/currentDraftPlayerUniverse2026.ts", import.meta.url);
const OUTPUT_PATH = new URL("../free_agents_2025_offense_complete_v3_9aa995df.json", import.meta.url);
const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const STORAGE_KEY = "free_agents_2025_offense_complete_v3_9aa995df.json";

function number(value) {
  const n = parseFloat(value ?? "0");
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function canonicalName(name) {
  return name.trim().replace(/\s+(Jr\.|Sr\.|II|III|IV)$/i, "").toLowerCase();
}

function playerPool() {
  // currentDraftPlayerUniverse2026.ts is the actual, current, comprehensive
  // player list the rest of the app uses (queue, draft board, protections).
  // The old nflPlayers2026.ts this used to read from is a smaller, stale
  // list that was missing players entirely (e.g. Luther Burden III), so
  // anyone missing from it silently got no season-stats entry at all --
  // not even a zero-stat placeholder.
  const text = readFileSync(PLAYERS_PATH, "utf-8");
  const match = text.match(/String\.raw`\n(\[.*\])\n`/s);
  if (!match) throw new Error("Could not locate the player universe JSON array in currentDraftPlayerUniverse2026.ts");
  const players = JSON.parse(match[1]);
  const pool = new Map();
  for (const p of players) {
    if (p.pos === "QB" || p.pos === "RB" || p.pos === "WR" || p.pos === "TE") {
      pool.set(p.name, { pos: p.pos, team: p.nflTeam });
    }
  }
  return pool;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Fetch failed for ${url}: ${response.status}`);
  return response.text();
}

async function rosterIds(pool) {
  const poolByCanonical = new Map();
  for (const name of pool.keys()) poolByCanonical.set(canonicalName(name), name);

  const csvText = await fetchText(ROSTER_URL);
  const records = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const ids = new Map();
  for await (const row of records) {
    const canonical = canonicalName(row.full_name ?? "");
    if (row.gsis_id && poolByCanonical.has(canonical)) {
      ids.set(row.gsis_id, poolByCanonical.get(canonical));
    }
  }
  return ids;
}

function emptyStat() {
  return {
    passYds: 0, passTd: 0, passInt: 0,
    rushAtt: 0, rushYds: 0, rushTd: 0,
    rec: 0, recYds: 0, recTd: 0,
    fumblesLost: 0, returnTd: 0, games: new Set(),
  };
}

async function aggregatePbp(ids) {
  const byName = new Map();
  const getStat = name => {
    if (!byName.has(name)) byName.set(name, emptyStat());
    return byName.get(name);
  };

  console.log("Downloading play-by-play data (~19MB gzipped)...");
  const response = await fetch(PBP_URL, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`PBP fetch failed: ${response.status}`);

  const gunzip = zlib.createGunzip();
  const parser = parse({ columns: true, skip_empty_lines: true, relax_column_count: true });
  const nodeReadable = Readable.fromWeb(response.body);

  let rowCount = 0;
  const consume = pipeline(nodeReadable, gunzip, parser);

  for await (const row of parser) {
    rowCount += 1;
    if (row.season !== "2025" || row.season_type !== "REG") continue;
    const gameId = row.game_id ?? "";

    const passer = ids.get(row.passer_player_id ?? "");
    if (passer) {
      const stat = getStat(passer);
      stat.passYds += number(row.passing_yards);
      stat.passTd += number(row.pass_touchdown);
      stat.passInt += number(row.interception);
      stat.games.add(gameId);
    }

    const rusher = ids.get(row.rusher_player_id ?? "");
    if (rusher) {
      const stat = getStat(rusher);
      stat.rushAtt += number(row.rush_attempt);
      stat.rushYds += number(row.rushing_yards);
      stat.rushTd += number(row.rush_touchdown);
      stat.games.add(gameId);
    }

    const receiver = ids.get(row.receiver_player_id ?? "");
    if (receiver) {
      const stat = getStat(receiver);
      stat.rec += number(row.complete_pass);
      stat.recYds += number(row.receiving_yards);
      stat.recTd += number(row.pass_touchdown);
      stat.games.add(gameId);
    }

    const fumbler = ids.get(row.fumbled_1_player_id ?? "");
    if (fumbler && number(row.fumble_lost)) {
      const stat = getStat(fumbler);
      stat.fumblesLost += 1;
      stat.games.add(gameId);
    }

    const scorer = ids.get(row.fantasy_player_id ?? "");
    if (scorer && number(row.return_touchdown)) {
      const stat = getStat(scorer);
      stat.returnTd += 1;
      stat.games.add(gameId);
    }
  }

  await consume;
  console.log(`Processed ${rowCount} play-by-play rows.`);
  return byName;
}

async function main() {
  const pool = playerPool();
  console.log(`Loaded ${pool.size} offensive players from the 2026 pool.`);
  const ids = await rosterIds(pool);
  console.log(`Resolved ${ids.size} roster gsis_id -> pool player mappings.`);
  const byName = await aggregatePbp(ids);

  const output = {};
  for (const [name, metadata] of pool.entries()) {
    const stat = byName.get(name) ?? emptyStat();
    output[name] = {
      pos: metadata.pos,
      passYds: stat.passYds, passTd: stat.passTd, passInt: stat.passInt,
      rushAtt: stat.rushAtt, rushYds: stat.rushYds, rushTd: stat.rushTd,
      rec: stat.rec, recYds: stat.recYds, recTd: stat.recTd,
      fumblesLost: stat.fumblesLost, returnTd: stat.returnTd,
      games: stat.games.size,
    };
  }

  const sortedOutput = {};
  for (const name of Object.keys(output).sort()) sortedOutput[name] = output[name];
  const json = JSON.stringify(sortedOutput, null, 2);
  writeFileSync(OUTPUT_PATH, json, "utf-8");
  console.log(`Wrote ${Object.keys(output).length} completed-season player records to ${OUTPUT_PATH.pathname}`);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.log("SUPABASE_SERVICE_ROLE_KEY not set in this shell — skipping upload. Upload the file manually or re-run with the env var set.");
    return;
  }
  const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabaseAdmin.storage.from("site-assets").upload(STORAGE_KEY, json, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(`Upload to site-assets failed: ${error.message}`);
  console.log(`Uploaded to site-assets/${STORAGE_KEY}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
