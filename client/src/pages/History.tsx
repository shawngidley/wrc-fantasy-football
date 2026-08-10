/**
 * WRC Fantasy Football - History Page
 * Accurate 2022-2025 standings, playoff results, and champions from league records.
 */
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy } from "lucide-react";

// ── Season data ───────────────────────────────────────────────────────────────

const SEASONS = [
  {
    year: 2025,
    champion: { team: "Legion of Doom", owner: "Dan", score: "202.70-141.48" },
    runnerUp: { team: "Xavier Musketeers", owner: "Scott M." },
    divisions: [
      {
        name: "East",
        teams: [
          { owner: "Keith",    team: "HamSandwich",            w: 27, l: 15, gb: "—",  h2hW: 9,  h2hL: 5,  medW: 9,  medL: 5,  divW: 2, divL: 4, ptsF: 1907.24, ptsA: 1794.12, clinched: "@" },
          { owner: "Jonas",    team: "The Super Snuffleupagus", w: 26, l: 16, gb: 1,   h2hW: 9,  h2hL: 5,  medW: 8,  medL: 6,  divW: 3, divL: 3, ptsF: 1871.64, ptsA: 1761.96, clinched: "#" },
          { owner: "Jason",    team: "Heiden's Hardtimes",      w: 22, l: 20, gb: 5,   h2hW: 8,  h2hL: 6,  medW: 6,  medL: 8,  divW: 3, divL: 3, ptsF: 1769.80, ptsA: 1706.58 },
          { owner: "David R.", team: "The Boys of Fall",        w: 17, l: 25, gb: 10,  h2hW: 6,  h2hL: 8,  medW: 5,  medL: 9,  divW: 4, divL: 2, ptsF: 1749.64, ptsA: 1799.58 },
        ],
      },
      {
        name: "Central",
        teams: [
          { owner: "Jamie",    team: "The Four Horsemen",  w: 26, l: 16, gb: "—",  h2hW: 9,  h2hL: 5,  medW: 8,  medL: 6,  divW: 4, divL: 2, ptsF: 1774.48, ptsA: 1761.14, clinched: "@" },
          { owner: "Dan",      team: "Legion of Doom",     w: 26, l: 16, gb: 0,   h2hW: 8,  h2hL: 6,  medW: 10, medL: 4,  divW: 3, divL: 3, ptsF: 1929.64, ptsA: 1814.96, clinched: "#" },
          { owner: "Scott N.", team: "Millertime",         w: 22, l: 20, gb: 4,   h2hW: 7,  h2hL: 7,  medW: 8,  medL: 6,  divW: 2, divL: 4, ptsF: 1906.20, ptsA: 1861.32 },
          { owner: "Bill",     team: "Billy Goats Gruff",  w: 14, l: 28, gb: 12,  h2hW: 5,  h2hL: 9,  medW: 4,  medL: 10, divW: 3, divL: 3, ptsF: 1650.22, ptsA: 1877.10 },
        ],
      },
      {
        name: "West",
        teams: [
          { owner: "Scott M.", team: "Xavier Musketeers",     w: 27, l: 15, gb: "—",  h2hW: 9,  h2hL: 5,  medW: 9,  medL: 5,  divW: 6, divL: 0, ptsF: 1904.40, ptsA: 1748.90, clinched: "@" },
          { owner: "David S.", team: "Legends",               w: 25, l: 17, gb: 2,   h2hW: 8,  h2hL: 6,  medW: 9,  medL: 5,  divW: 3, divL: 3, ptsF: 1999.02, ptsA: 1959.82, clinched: "#" },
          { owner: "Shawn",    team: "Vipers",                w: 12, l: 30, gb: 15,  h2hW: 3,  h2hL: 11, medW: 6,  medL: 8,  divW: 1, divL: 5, ptsF: 1739.70, ptsA: 1898.16 },
          { owner: "Greg",     team: 'Larry "Bud" Melman123', w: 8,  l: 34, gb: 19,  h2hW: 3,  h2hL: 11, medW: 2,  medL: 12, divW: 2, divL: 4, ptsF: 1600.14, ptsA: 1818.48 },
        ],
      },
    ],
    playoffs: [
      { round: "Wild Card (Wk 15, Dec. 11-15)",     results: ["Jamie vs. David S. — Jamie 156.80-143.78", "Dan vs. Jonas — Dan 147.66-117.84"] },
      { round: "Divisional (Wk 16, Dec. 18-22)",    results: ["Keith vs. Dan — Dan 182.46-139.40", "Scott M. vs. Jamie — Scott M. 139.90-139.60"] },
      { round: "Super Bowl (Wk 17, Dec. 25-29)",    results: ["Dan vs. Scott M. — Dan 202.70-141.48"] },
    ],
  },
  {
    year: 2024,
    champion: { team: "Vipers", owner: "Shawn", score: "198.84-117.36" },
    runnerUp: { team: "Millertime", owner: "Scott N." },
    divisions: [
      {
        name: "East",
        teams: [
          { owner: "Keith",    team: "HamSandwich",            w: 21, l: 21, gb: "—",  h2hW: 7,  h2hL: 7,  medW: 7,  medL: 7,  divW: 4, divL: 2, ptsF: 1914.20, ptsA: 1866.52, clinched: "@" },
          { owner: "Jonas",    team: "The Super Snuffleupagus", w: 18, l: 24, gb: 3,   h2hW: 6,  h2hL: 8,  medW: 6,  medL: 8,  divW: 3, divL: 3, ptsF: 1653.20, ptsA: 1867.53 },
          { owner: "Jason",    team: "Heiden's Hardtimes",      w: 16, l: 26, gb: 5,   h2hW: 6,  h2hL: 8,  medW: 4,  medL: 10, divW: 4, divL: 2, ptsF: 1693.16, ptsA: 1789.52 },
          { owner: "David R.", team: "The Boys of Fall",        w: 14, l: 28, gb: 7,   h2hW: 3,  h2hL: 11, medW: 8,  medL: 6,  divW: 1, divL: 5, ptsF: 1823.25, ptsA: 1982.30 },
        ],
      },
      {
        name: "Central",
        teams: [
          { owner: "Scott N.", team: "Millertime",         w: 30, l: 12, gb: "—",  h2hW: 10, h2hL: 4,  medW: 10, medL: 4,  divW: 5, divL: 1, ptsF: 1998.02, ptsA: 1841.14, clinched: "@" },
          { owner: "Bill",     team: "Billy Goats Gruff",  w: 28, l: 14, gb: 2,   h2hW: 10, h2hL: 4,  medW: 8,  medL: 6,  divW: 3, divL: 3, ptsF: 1860.40, ptsA: 1828.54, clinched: "#" },
          { owner: "Jamie",    team: "The Four Horsemen",  w: 27, l: 15, gb: 3,   h2hW: 9,  h2hL: 5,  medW: 9,  medL: 5,  divW: 2, divL: 4, ptsF: 1959.44, ptsA: 1815.12, clinched: "#" },
          { owner: "Dan",      team: "Legion of Doom",     w: 24, l: 18, gb: 6,   h2hW: 8,  h2hL: 6,  medW: 8,  medL: 6,  divW: 2, divL: 4, ptsF: 1937.70, ptsA: 1807.64, clinched: "#" },
        ],
      },
      {
        name: "West",
        teams: [
          { owner: "Shawn",    team: "Vipers",                w: 34, l: 8,  gb: "—",  h2hW: 11, h2hL: 3,  medW: 12, medL: 2,  divW: 5, divL: 1, ptsF: 2084.22, ptsA: 1732.60, clinched: "@" },
          { owner: "David S.", team: "Legends",               w: 16, l: 26, gb: 18,  h2hW: 5,  h2hL: 9,  medW: 6,  medL: 8,  divW: 3, divL: 3, ptsF: 1844.26, ptsA: 1909.16 },
          { owner: "Greg",     team: 'Larry "Bud" Melman123', w: 13, l: 29, gb: 21,  h2hW: 5,  h2hL: 9,  medW: 3,  medL: 11, divW: 2, divL: 4, ptsF: 1559.50, ptsA: 1750.82 },
          { owner: "David Z.", team: "The Bison",             w: 11, l: 31, gb: 23,  h2hW: 4,  h2hL: 10, medW: 3,  medL: 11, divW: 2, divL: 4, ptsF: 1670.62, ptsA: 1807.08 },
        ],
      },
    ],
    playoffs: [
      { round: "Wild Card (Wk 15, Dec. 12-16)",     results: ["Keith vs. Dan — Dan 145.38-138.10", "Bill vs. Jamie — Jamie 166.66-156.50"] },
      { round: "Divisional (Wk 16, Dec. 19-23)",    results: ["Shawn vs. Dan — Shawn 137.80-128.84", "Scott vs. Jamie — Scott 164.44-163.02"] },
      { round: "Super Bowl (Wk 17, Dec. 25-30)",    results: ["Shawn vs. Scott — Shawn 198.84-117.36"] },
    ],
  },
  {
    year: 2023,
    champion: { team: "The Four Horsemen", owner: "Jamie", score: "147.06-102.46" },
    runnerUp: { team: "Legends", owner: "David S." },
    divisions: [
      {
        name: "East",
        teams: [
          { owner: "Jason",    team: "Heiden's Hardtimes",      w: 37, l: 5,  gb: "—",  h2hW: 13, h2hL: 1,  medW: 11, medL: 3,  divW: 6, divL: 0, ptsF: 1924.06, ptsA: 1638.74, clinched: "@" },
          { owner: "David R.", team: "The Boys of Fall",        w: 18, l: 24, gb: 19,  h2hW: 6,  h2hL: 8,  medW: 6,  medL: 8,  divW: 4, divL: 2, ptsF: 1734.72, ptsA: 1756.32 },
          { owner: "Jonas",    team: "The Super Snuffleupagus", w: 14, l: 28, gb: 23,  h2hW: 4,  h2hL: 10, medW: 6,  medL: 8,  divW: 1, divL: 5, ptsF: 1721.18, ptsA: 1901.18 },
          { owner: "Keith",    team: "HamSandwich",            w: 9,  l: 33, gb: 28,  h2hW: 3,  h2hL: 11, medW: 3,  medL: 11, divW: 1, divL: 5, ptsF: 1669.40, ptsA: 1890.60 },
        ],
      },
      {
        name: "Central",
        teams: [
          { owner: "Jamie",    team: "The Four Horsemen",  w: 25, l: 17, gb: "—",  h2hW: 8,  h2hL: 6,  medW: 9,  medL: 5,  divW: 5, divL: 1, ptsF: 1995.48, ptsA: 1825.48, clinched: "@" },
          { owner: "Dan",      team: "Legion of Doom",     w: 20, l: 22, gb: 5,   h2hW: 7,  h2hL: 7,  medW: 6,  medL: 8,  divW: 4, divL: 2, ptsF: 1828.86, ptsA: 1900.26, clinched: "#" },
          { owner: "Scott N.", team: "Millertime",         w: 15, l: 27, gb: 10,  h2hW: 5,  h2hL: 9,  medW: 5,  medL: 9,  divW: 2, divL: 4, ptsF: 1672.50, ptsA: 1858.48 },
          { owner: "Bill",     team: "Billy Goats Gruff",  w: 14, l: 28, gb: 11,  h2hW: 4,  h2hL: 10, medW: 6,  medL: 8,  divW: 1, divL: 5, ptsF: 1778.96, ptsA: 1921.32 },
        ],
      },
      {
        name: "West",
        teams: [
          { owner: "Shawn",    team: "Vipers",                w: 32, l: 10, gb: "—",  h2hW: 11, h2hL: 3,  medW: 10, medL: 4,  divW: 5, divL: 1, ptsF: 1934.08, ptsA: 1686.04, clinched: "@" },
          { owner: "David S.", team: "Legends",               w: 26, l: 16, gb: 6,   h2hW: 9,  h2hL: 5,  medW: 9,  medL: 5,  divW: 3, divL: 3, ptsF: 1935.94, ptsA: 1800.02, clinched: "#" },
          { owner: "Greg",     team: 'Larry "Bud" Melman123', w: 22, l: 20, gb: 10,  h2hW: 8,  h2hL: 6,  medW: 6,  medL: 8,  divW: 3, divL: 3, ptsF: 1698.36, ptsA: 1721.18, clinched: "#" },
          { owner: "David Z.", team: "Los Pollos Hermanos",   w: 17, l: 25, gb: 15,  h2hW: 5,  h2hL: 9,  medW: 7,  medL: 7,  divW: 1, divL: 5, ptsF: 1836.22, ptsA: 1871.10 },
        ],
      },
    ],
    playoffs: [
      { round: "Wild Card (Wk 15, Dec. 14-18)",     results: ["Dan vs. Jamie — Jamie 134.06-131.86", "Greg vs. David S. — David S. 97.28-72.88"] },
      { round: "Divisional (Wk 16, Dec. 21-25)",    results: ["David S. vs. Jason — David S. 115.84-105.82", "Jamie vs. Shawn — Jamie 193.84-105.36"] },
      { round: "Super Bowl (Wk 17, Dec. 28-31)",    results: ["David S. vs. Jamie — Jamie 147.06-102.46"] },
    ],
  },
  {
    year: 2022,
    champion: { team: "Legends", owner: "David S.", score: "David S. 8-5 (playoff format)" },
    runnerUp: { team: "The Boys of Fall", owner: "David R." },
    divisions: [
      {
        name: "East",
        teams: [
          { owner: "David R.", team: "The Boys of Fall",        w: 11, l: 3,  gb: "—",  divW: 5, divL: 1, ptsF: null, ptsA: null, clinched: "@" },
          { owner: "Jason",    team: "Heiden's Hardtimes",      w: 8,  l: 6,  gb: 3,   divW: 4, divL: 2, ptsF: null, ptsA: null, clinched: "#" },
          { owner: "Jonas",    team: "The Super Snuffleupagus", w: 8,  l: 6,  gb: 3,   divW: 2, divL: 4, ptsF: null, ptsA: null, clinched: "#" },
          { owner: "Keith",    team: "HamSandwich",            w: 3,  l: 11, gb: 8,   divW: 1, divL: 5, ptsF: null, ptsA: null },
        ],
      },
      {
        name: "Central",
        teams: [
          { owner: "Dan",      team: "Legion of Doom",     w: 9,  l: 5,  gb: "—",  divW: 5, divL: 1, ptsF: null, ptsA: null, clinched: "@" },
          { owner: "Scott N.", team: "Millertime",         w: 6,  l: 8,  gb: 3,   divW: 3, divL: 3, ptsF: null, ptsA: null },
          { owner: "Jamie",    team: "The Four Horsemen",  w: 4,  l: 10, gb: 5,   divW: 2, divL: 4, ptsF: null, ptsA: null },
          { owner: "Bill",     team: "Billy Goats Gruff",  w: 4,  l: 10, gb: 5,   divW: 2, divL: 4, ptsF: null, ptsA: null },
        ],
      },
      {
        name: "West",
        teams: [
          { owner: "David S.", team: "Legends",               w: 12, l: 2,  gb: "—",  divW: 4, divL: 2, ptsF: null, ptsA: null, clinched: "@" },
          { owner: "Greg",     team: 'Larry "Bud" Melman123', w: 7,  l: 7,  gb: 5,   divW: 3, divL: 3, ptsF: null, ptsA: null, clinched: "#" },
          { owner: "Shawn",    team: "Vipers",                w: 6,  l: 8,  gb: 6,   divW: 3, divL: 3, ptsF: null, ptsA: null },
          { owner: "David Z.", team: "The Bison",             w: 6,  l: 8,  gb: 6,   divW: 2, divL: 4, ptsF: null, ptsA: null },
        ],
      },
    ],
    playoffs: [
      { round: "Wild Card (Wk 15, Dec. 15-19)",     results: ["Dan vs. Greg — Dan 9-4", "Jason vs. Jonas — Jason 9-3"] },
      { round: "Divisional (Wk 16, Dec. 22-26)",    results: ["David S. vs. Jason — David S. 8-5", "David R. vs. Dan — David R. 7-6"] },
      { round: "Super Bowl (Wk 17-18, Dec. 29-Jan. 8)", results: ["David S. vs. David R. — David S. 8-5"] },
    ],
  },
];

// ── Derived champions list ────────────────────────────────────────────────────
const CHAMPIONS = SEASONS.map(s => ({
  year: s.year,
  team: s.champion.team,
  owner: s.champion.owner,
  score: s.champion.score,
}));

// ── All-time records computed from season data ────────────────────────────────
type TeamRecord = { team: string; owner: string; w: number; l: number; titles: number };
const allTimeMap: Record<string, TeamRecord> = {};
for (const season of SEASONS) {
  for (const div of season.divisions) {
    for (const t of div.teams) {
      const key = t.team;
      if (!allTimeMap[key]) allTimeMap[key] = { team: t.team, owner: t.owner, w: 0, l: 0, titles: 0 };
      allTimeMap[key].w += t.w;
      allTimeMap[key].l += t.l;
    }
  }
  allTimeMap[season.champion.team].titles = (allTimeMap[season.champion.team]?.titles ?? 0) + 1;
}
// Merge David Z. franchises (The Bison + Los Pollos Hermanos) into Scott M. / Xavier Musketeers
// Scott M. took over David Z.'s franchise
const davidZTeams = ["The Bison", "Los Pollos Hermanos"];
const scottMKey = "Xavier Musketeers";
for (const dzTeam of davidZTeams) {
  if (allTimeMap[dzTeam]) {
    if (!allTimeMap[scottMKey]) allTimeMap[scottMKey] = { team: scottMKey, owner: "Scott M.", w: 0, l: 0, titles: 0 };
    allTimeMap[scottMKey].w += allTimeMap[dzTeam].w;
    allTimeMap[scottMKey].l += allTimeMap[dzTeam].l;
    allTimeMap[scottMKey].titles += allTimeMap[dzTeam].titles;
    delete allTimeMap[dzTeam];
  }
}
const ALL_TIME = Object.values(allTimeMap)
  .sort((a, b) => (b.w / (b.w + b.l || 1)) - (a.w / (a.w + a.l || 1)));

// ── Styles ────────────────────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.65rem",
  letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.35rem 0.4rem",
  textAlign: "center", whiteSpace: "nowrap", color: "rgba(255,255,255,0.9)",
};
const TD: React.CSSProperties = { padding: "0.35rem 0.4rem", fontSize: "0.75rem", textAlign: "center" };

import React from "react";

export default function History() {
  const { franchise } = useAuth();
  const [activeYear, setActiveYear] = React.useState(2025);
  const season = SEASONS.find(s => s.year === activeYear)!;

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Franchise History</h1>
          <p>WRC Champions, season standings, and playoff results</p>
        </div>

        {/* ── Champions Banner ── */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ background: "linear-gradient(90deg, oklch(0.55 0.14 85), oklch(0.68 0.16 85))", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Trophy size={16} color="oklch(0.15 0.02 150)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.15 0.02 150)" }}>WRC Champions</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={TH}>Year</th>
                  <th style={{ ...TH, textAlign: "left" }}>Champion</th>
                  <th style={TH}>Owner</th>
                  <th style={{ ...TH, textAlign: "left" }}>Super Bowl</th>
                </tr>
              </thead>
              <tbody>
                {CHAMPIONS.map(c => (
                  <tr key={c.year} style={{ cursor: "pointer", background: activeYear === c.year ? "oklch(0.93 0.04 150)" : undefined }}
                    onClick={() => setActiveYear(c.year)}>
                    <td style={{ ...TD, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{c.year}</td>
                    <td style={{ ...TD, textAlign: "left", fontWeight: 700 }}>
                      <Trophy size={12} color="oklch(0.65 0.14 85)" style={{ marginRight: 4, verticalAlign: "middle" }} />{c.team}
                    </td>
                    <td style={TD}>{c.owner}</td>
                    <td style={{ ...TD, textAlign: "left", fontSize: "0.7rem", color: "oklch(0.45 0.06 150)" }}>{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Year selector ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {SEASONS.map(s => (
            <button key={s.year} onClick={() => setActiveYear(s.year)} style={{
              fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem",
              letterSpacing: "0.06em", padding: "0.4rem 1.1rem", borderRadius: 8, border: "none",
              cursor: "pointer",
              background: activeYear === s.year ? "oklch(0.28 0.09 150)" : "white",
              color: activeYear === s.year ? "white" : "oklch(0.35 0.06 150)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}>{s.year}</button>
          ))}
        </div>

        {/* ── Season Standings ── */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">{activeYear} Season Standings</div>
          {season.divisions.map(div => (
            <div key={div.name} style={{ marginBottom: "1rem" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.42 0.14 150)", padding: "0.4rem 1rem 0.2rem", borderTop: "1px solid oklch(0.92 0.01 150)" }}>{div.name} Division</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: "oklch(0.22 0.08 150)" }}>
                      <th style={{ ...TH, textAlign: "left", paddingLeft: "0.75rem" }}>Team</th>
                      <th style={TH}>Owner</th>
                      <th style={TH}>W</th>
                      <th style={TH}>L</th>
                      <th style={TH}>GB</th>
                      {"h2hW" in div.teams[0] && <><th style={TH}>H2H W</th><th style={TH}>H2H L</th></>}
                      {"medW" in div.teams[0] && <><th style={TH}>Med W</th><th style={TH}>Med L</th></>}
                      <th style={TH}>Div W</th>
                      <th style={TH}>Div L</th>
                      {div.teams[0].ptsF !== null && <><th style={{ ...TH, color: "oklch(0.88 0.15 85)" }}>PtsF</th><th style={TH}>PtsA</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {div.teams.map((t, i) => (
                      <tr key={t.team} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                        <td style={{ ...TD, textAlign: "left", paddingLeft: "0.75rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif" }}>
                          {t.clinched === "@" && <span title="Division Title" style={{ color: "oklch(0.55 0.16 85)", marginRight: 3, fontSize: "0.7rem" }}>@</span>}
                          {t.clinched === "#" && <span title="Playoff Berth" style={{ color: "oklch(0.42 0.14 150)", marginRight: 3, fontSize: "0.7rem" }}>#</span>}
                          <span style={{ color: "oklch(0.18 0.06 150)" }}>{t.team}</span>
                        </td>
                        <td style={{ ...TD, fontSize: "0.7rem", color: "oklch(0.5 0.04 150)" }}>{t.owner}</td>
                        <td style={{ ...TD, fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{t.w}</td>
                        <td style={TD}>{t.l}</td>
                        <td style={{ ...TD, color: "oklch(0.55 0.04 150)" }}>{t.gb}</td>
                        {"h2hW" in t && <><td style={{ ...TD, color: "oklch(0.35 0.14 150)", fontWeight: 600 }}>{(t as {h2hW:number}).h2hW}</td><td style={{ ...TD, color: "oklch(0.5 0.14 25)" }}>{(t as {h2hL:number}).h2hL}</td></>}
                        {"medW" in t && <><td style={{ ...TD, color: "oklch(0.35 0.14 150)", fontWeight: 600 }}>{(t as {medW:number}).medW}</td><td style={{ ...TD, color: "oklch(0.5 0.14 25)" }}>{(t as {medL:number}).medL}</td></>}
                        <td style={{ ...TD, color: "oklch(0.35 0.14 150)", fontWeight: 600 }}>{t.divW}</td>
                        <td style={{ ...TD, color: "oklch(0.5 0.14 25)" }}>{t.divL}</td>
                        {t.ptsF !== null && <><td style={{ ...TD, fontWeight: 700, color: "oklch(0.38 0.18 85)" }}>{t.ptsF?.toFixed(2)}</td><td style={TD}>{t.ptsA?.toFixed(2)}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div style={{ padding: "0.35rem 1rem 0.75rem", fontSize: "0.68rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic" }}>
            @ Clinched Division Title &nbsp;·&nbsp; # Clinched Playoff Berth
          </div>
        </div>

        {/* ── Playoff Results ── */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Trophy size={14} color="oklch(0.65 0.14 85)" /> {activeYear} Playoff Results
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            {season.playoffs.map(p => (
              <div key={p.round} style={{ marginBottom: "1rem" }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", color: "oklch(0.28 0.09 150)", marginBottom: "0.35rem" }}>{p.round}</div>
                {p.results.map((r, i) => (
                  <div key={i} style={{ fontSize: "0.82rem", color: "oklch(0.38 0.06 150)", padding: "0.2rem 0 0.2rem 0.75rem", borderLeft: "3px solid oklch(0.78 0.15 85)" }}>{r}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── All-Time Records ── */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">All-Time Franchise Records (2022–2025)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Franchise</th>
                  <th style={TH}>Owner</th>
                  <th style={TH}>W</th>
                  <th style={TH}>L</th>
                  <th style={TH}>PCT</th>
                  <th style={TH}>Titles</th>
                </tr>
              </thead>
              <tbody>
                {ALL_TIME.map((t, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                    <td style={{ padding: "0.4rem 0.75rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem" }}>{t.team}</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "center", fontSize: "0.75rem", color: "oklch(0.5 0.04 150)" }}>{t.owner}</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "center", fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{t.w}</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{t.l}</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "center", fontWeight: 600 }}>{((t.w / (t.w + t.l)) * 100).toFixed(1)}%</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{t.titles > 0 ? <span style={{ color: "oklch(0.65 0.14 85)" }}>{"🏆".repeat(t.titles)}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
