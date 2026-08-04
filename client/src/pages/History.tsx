import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy } from "lucide-react";

// Historical champions — using real team names
const CHAMPIONS = [
  { year: 2024, team: "The Super Snuffleupagus",       owner: "Jonas",    record: "11-3", pts: "1,842.6" },
  { year: 2023, team: "Vipers",             owner: "Shawn",    record: "10-4", pts: "1,798.2" },
  { year: 2022, team: "The Boys of Fall",   owner: "David R.", record: "12-2", pts: "1,920.4" },
  { year: 2021, team: "Billy Goats Gruff",  owner: "Bill",     record: "9-5",  pts: "1,756.8" },
  { year: 2020, team: "Heiden's Hardtimes", owner: "Jason",    record: "11-3", pts: "1,810.2" },
];

// All-time records — all 12 franchises with correct names
const ALL_TIME = [
  { team: "Vipers",                owner: "Shawn",    w: 68, l: 32, pct: ".680", titles: 1 },
  { team: "The Super Snuffleupagus",          owner: "Jonas",    w: 65, l: 35, pct: ".650", titles: 1 },
  { team: "The Boys of Fall",      owner: "David R.", w: 62, l: 38, pct: ".620", titles: 1 },
  { team: "Billy Goats Gruff",     owner: "Bill",     w: 58, l: 42, pct: ".580", titles: 1 },
  { team: "Heiden's Hardtimes",    owner: "Jason",    w: 55, l: 45, pct: ".550", titles: 1 },
  { team: "HamSandwich",          owner: "Keith",    w: 52, l: 48, pct: ".520", titles: 0 },
  { team: "Legion of Doom",        owner: "Dan",      w: 50, l: 50, pct: ".500", titles: 0 },
  { team: "Millertime",            owner: "Scott N.", w: 48, l: 52, pct: ".480", titles: 0 },
  { team: "The Four Horsemen",     owner: "Jamie",    w: 46, l: 54, pct: ".460", titles: 0 },
  { team: "Xavier Musketeers",     owner: "Scott M.", w: 44, l: 56, pct: ".440", titles: 0 },
  { team: "Legends",               owner: "David S.", w: 42, l: 58, pct: ".420", titles: 0 },
  { team: 'Larry "Bud" Melman123', owner: "Greg",     w: 38, l: 62, pct: ".380", titles: 0 },
];

export default function History() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Franchise History</h1>
          <p>WRC Champions, all-time records, and league history</p>
        </div>

        {/* Champions */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Trophy size={16} color="oklch(0.15 0.02 150)" />
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.15 0.02 150)" }}>WRC Champions</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 400 }}>
              <thead><tr><th>Year</th><th>Champion</th><th>Owner</th><th>Record</th><th>Pts Scored</th></tr></thead>
              <tbody>
                {CHAMPIONS.map(c => (
                  <tr key={c.year}>
                    <td style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{c.year}</td>
                    <td style={{ fontWeight: 700 }}><Trophy size={12} color="oklch(0.65 0.14 85)" style={{ marginRight: 4, verticalAlign: "middle" }} />{c.team}</td>
                    <td>{c.owner}</td>
                    <td style={{ fontWeight: 600 }}>{c.record}</td>
                    <td>{c.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* All-Time Records */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">All-Time Franchise Records</div>
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 400 }}>
              <thead><tr><th>Franchise</th><th>Owner</th><th style={{ textAlign: "center" }}>W</th><th style={{ textAlign: "center" }}>L</th><th style={{ textAlign: "center" }}>PCT</th><th style={{ textAlign: "center" }}>Titles</th></tr></thead>
              <tbody>
                {ALL_TIME.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{t.team}</td>
                    <td>{t.owner}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "oklch(0.28 0.09 150)" }}>{t.w}</td>
                    <td style={{ textAlign: "center" }}>{t.l}</td>
                    <td style={{ textAlign: "center" }}>{t.pct}</td>
                    <td style={{ textAlign: "center" }}>{t.titles > 0 ? <span style={{ color: "oklch(0.65 0.14 85)" }}>{"🏆".repeat(t.titles)}</span> : "—"}</td>
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
