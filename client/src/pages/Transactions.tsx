import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from "lucide-react";

const TRANSACTIONS = [
  { type: "ADD", team: "Team Gidley", player: "Gus Edwards", pos: "RB", nflTeam: "LAC", date: "Dec 18, 2025", faab: "$24" },
  { type: "DROP", team: "Team Gidley", player: "Ezekiel Elliott", pos: "RB", nflTeam: "FA", date: "Dec 18, 2025", faab: null },
  { type: "TRADE", team: "Team Sotka", player: "Travis Kelce → Team Krause", pos: "TE", nflTeam: "KC", date: "Dec 15, 2025", faab: null },
  { type: "ADD", team: "Team Pattie", player: "Elijah Moore", pos: "WR", nflTeam: "CLE", date: "Dec 14, 2025", faab: "$8" },
  { type: "DROP", team: "Team Pattie", player: "Parris Campbell", pos: "WR", nflTeam: "FA", date: "Dec 14, 2025", faab: null },
  { type: "ADD", team: "Team Heiden", player: "Tyjae Spears", pos: "RB", nflTeam: "TEN", date: "Dec 11, 2025", faab: "$15" },
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ADD: <ArrowUpCircle size={16} color="oklch(0.42 0.15 150)" />,
  DROP: <ArrowDownCircle size={16} color="oklch(0.55 0.22 25)" />,
  TRADE: <ArrowLeftRight size={16} color="oklch(0.55 0.18 260)" />,
};
const TYPE_COLORS: Record<string, string> = {
  ADD: "oklch(0.42 0.15 150)", DROP: "oklch(0.55 0.22 25)", TRADE: "oklch(0.55 0.18 260)",
};

export default function Transactions() {
  const { franchise } = useAuth();
  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Transactions</h1>
          <p>All adds, drops, and trades — 2026 Season</p>
        </div>
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div style={{ overflowX: "auto" }}>
            <table className="wrc-table" style={{ minWidth: 500 }}>
              <thead><tr><th>Type</th><th>Team</th><th>Player</th><th>Pos</th><th>FAAB</th><th>Date</th></tr></thead>
              <tbody>
                {TRANSACTIONS.map((t, i) => (
                  <tr key={i}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>{TYPE_ICONS[t.type]}<span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 700, color: TYPE_COLORS[t.type], letterSpacing: "0.04em" }}>{t.type}</span></div></td>
                    <td style={{ fontWeight: 600 }}>{t.team}</td>
                    <td>{t.player}</td>
                    <td><span style={{ fontSize: "0.72rem", fontWeight: 700, color: "oklch(0.35 0.06 150)", background: "oklch(0.92 0.01 150)", borderRadius: 4, padding: "1px 6px" }}>{t.pos}</span></td>
                    <td style={{ fontWeight: 600, color: "oklch(0.28 0.09 150)" }}>{t.faab || "—"}</td>
                    <td style={{ color: "oklch(0.55 0.04 150)", fontSize: "0.82rem" }}>{t.date}</td>
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
