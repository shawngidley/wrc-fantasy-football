import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEAMS = [
  { team_id: "jonas",   team_name: "Jonas Pattie",          owner: "Jonas",    division: "East" },
  { team_id: "davidr",  team_name: "The Boys of Fall",       owner: "David R.", division: "East" },
  { team_id: "jason",   team_name: "Heiden's Hardtimes",     owner: "Jason",    division: "East" },
  { team_id: "jamie",   team_name: "The Four Horsemen",      owner: "Jamie",    division: "East" },
  { team_id: "keith",   team_name: "Keith Cromer",           owner: "Keith",    division: "Central" },
  { team_id: "dan",     team_name: "Legion of Doom",         owner: "Dan",      division: "Central" },
  { team_id: "scottn",  team_name: "Millertime",             owner: "Scott N.", division: "Central" },
  { team_id: "bill",    team_name: "Billy Goats Gruff",      owner: "Bill",     division: "Central" },
  { team_id: "scottm",  team_name: "Xavier Musketeers",      owner: "Scott M.", division: "West" },
  { team_id: "davids",  team_name: "Legends",                owner: "David S.", division: "West" },
  { team_id: "shawn",   team_name: "Vipers",                 owner: "Shawn",    division: "West" },
  { team_id: "greg",    team_name: 'Larry "Bud" Melman123',  owner: "Greg",     division: "West" },
];

const rows = TEAMS.map(t => ({
  team_id:      t.team_id,
  team_name:    t.team_name,
  owner:        t.owner,
  division:     t.division,
  wins:         0,
  losses:       0,
  ties:         0,
  pts_for:      0,
  pts_against:  0,
  h2h_wins:     0,
  h2h_losses:   0,
  median_wins:  0,
  median_losses:0,
  div_wins:     0,
  div_losses:   0,
  streak:       "W0",
}));

const { data, error } = await supabase
  .from("team_standings")
  .upsert(rows, { onConflict: "team_id" });

if (error) {
  console.error("Error seeding team_standings:", error.message);
} else {
  console.log(`Seeded ${rows.length} teams into team_standings.`);
}
