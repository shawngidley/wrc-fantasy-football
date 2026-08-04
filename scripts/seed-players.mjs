/**
 * seed-players.mjs
 * Clears the players table and re-seeds it from the 2025 Excel roster sheet
 * (which contains the current 2026 pre-draft rosters).
 *
 * Run: node scripts/seed-players.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Read the JSON we already extracted from Excel ─────────────────────────────
const rosterJson = JSON.parse(
  readFileSync("/home/ubuntu/roster_data_2025.json", "utf8")
);

// ── Owner → team_id + team_name mapping (matches wrcData.ts) ─────────────────
const OWNER_META = {
  "JONAS PATTIE":   { id: "jonas",   teamName: "Pattie's Gridiron Gurus",    owner: "Jonas" },
  "DAVID RYKS":     { id: "davidr",  teamName: "Ryks' Wrecking Crew",         owner: "David R." },
  "JASON HEIDEN":   { id: "jason",   teamName: "Heiden's Horde",              owner: "Jason" },
  "KEITH CROMER":   { id: "keith",   teamName: "Cromer's Crushers",           owner: "Keith" },
  "DAN OSICKI":     { id: "dan",     teamName: "Osicki's Outlaws",            owner: "Dan" },
  "JAMIE YANE":     { id: "jamie",   teamName: "The Four Horsemen",           owner: "Jamie" },
  "BILL KRAUSE":    { id: "bill",    teamName: "Krause's Krusaders",          owner: "Bill" },
  "SCOTT NELSON":   { id: "scottn",  teamName: "Nelson's Nightmares",         owner: "Scott N." },
  "SHAWN GIDLEY":   { id: "shawn",   teamName: "Gidley's Gridiron Gang",      owner: "Shawn" },
  "DAVID SOTKA":    { id: "davids",  teamName: "Sotka's Squad",               owner: "David S." },
  "GREG AKAGI":     { id: "greg",    teamName: "Akagi's Army",                owner: "Greg" },
  "SCOTT MACKAR":   { id: "scottm",  teamName: "Mackar's Marauders",          owner: "Scott M." },
};

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);

// ── Build rows ────────────────────────────────────────────────────────────────
const rows = [];
for (const [excelOwner, players] of Object.entries(rosterJson)) {
  const meta = OWNER_META[excelOwner];
  if (!meta) { console.warn("Unknown owner:", excelOwner); continue; }

  for (const p of players) {
    if (!VALID_POSITIONS.has(p.pos)) continue; // skip "Remaining FAAB $" rows
    const isDraft = typeof p.round === "number";
    rows.push({
      id: `${meta.id}-${p.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      team_id: `team-${meta.id}`,
      name: p.name,
      position: p.pos,
      nfl_team: p.team || "",
      acquisition: isDraft ? `Rd ${p.round}` : "FA",
      draft_round: isDraft ? p.round : null,
      draft_pick: null,
      status: "Active",
      season_fpts: 0,
      fpg: 0,
      bye_week: 0,
      stats: {},
      is_starter: false, // not used in new flat roster view
    });
  }
}

console.log(`Built ${rows.length} player rows across ${Object.keys(OWNER_META).length} teams`);

// ── Delete existing rows ──────────────────────────────────────────────────────
console.log("Deleting existing players...");
const { error: delError } = await sb
  .from("players")
  .delete()
  .neq("id", "___never___"); // delete all rows

if (delError) {
  console.error("Delete error:", delError.message);
  process.exit(1);
}
console.log("Deleted all existing players.");

// ── Insert in batches of 50 ───────────────────────────────────────────────────
const BATCH = 50;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await sb.from("players").insert(batch);
  if (error) {
    console.error(`Insert error at batch ${i}:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`\rInserted ${inserted}/${rows.length}...`);
}
console.log(`\nDone! Seeded ${inserted} players.`);
