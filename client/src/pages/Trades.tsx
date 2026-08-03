import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, Plus } from "lucide-react";

const TRADE_HISTORY = [
  { date: "Dec 15, 2025", team1: "Team Sotka", sends1: "Travis Kelce (TE)", team2: "Team Krause", sends2: "Jaylen Waddle (WR) + 2026 Rd 4", status: "Completed" },
  { date: "Nov 28, 2025", team1: "Team Gidley", sends1: "Davante Adams (WR)", team2: "Team Heiden", sends2: "Jahmyr Gibbs (RB)", status: "Completed" },
  { date: "Nov 10, 2025", team1: "Team Pattie", sends1: "2026 Rd 2 Pick", team2: "Team Akagi", sends2: "Justin Jefferson (WR)", status: "Completed" },
];

export default function Trades() {
  const { franchise } = useAuth();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}><h1>Trades</h1><p>Trade deadline: Nov 26, 2026 · 12:00pm ET</p></div>
          <button onClick={() => setShowForm(true)} style={{ background: "oklch(0.78 0.15 85)", color: "oklch(0.15 0.02 150)", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Plus size={14} /> Propose Trade
          </button>
        </div>

        {showForm && (
          <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
            <div className="wrc-card-gold-stripe" />
            <div className="wrc-card-header"><ArrowLeftRight size={14} /> New Trade Proposal</div>
            <div className="wrc-card-body" style={{ padding: "1.25rem" }}>
              <p style={{ color: "oklch(0.45 0.04 150)", fontSize: "0.875rem", margin: "0 0 1rem" }}>Trade proposals are sent to the other team's owner for review. Both parties must accept for the trade to process.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", display: "block", marginBottom: "0.4rem" }}>You Send</label>
                  <textarea placeholder="List players, picks, or FAAB..." style={{ width: "100%", padding: "0.6rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.35 0.06 150)", display: "block", marginBottom: "0.4rem" }}>You Receive</label>
                  <textarea placeholder="List players, picks, or FAAB..." style={{ width: "100%", padding: "0.6rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button style={{ background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Send Proposal</button>
                <button onClick={() => setShowForm(false)} style={{ background: "oklch(0.94 0.01 150)", color: "oklch(0.4 0.04 150)", border: "1px solid oklch(0.88 0.01 150)", borderRadius: 8, padding: "0.5rem 1.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header">Trade History — 2025 Season</div>
          <div>
            {TRADE_HISTORY.map((t, i) => (
              <div key={i} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid oklch(0.92 0.005 150)" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", color: "oklch(0.5 0.04 150)" }}>{t.date}</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "oklch(0.42 0.15 150)", background: "oklch(0.94 0.03 150)", borderRadius: 4, padding: "1px 6px" }}>{t.status}</span>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.22 0.08 150)", marginBottom: 2 }}>{t.team1}</div>
                    <div style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)" }}>Sends: {t.sends1}</div>
                  </div>
                  <ArrowLeftRight size={16} color="oklch(0.6 0.04 150)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "oklch(0.22 0.08 150)", marginBottom: 2 }}>{t.team2}</div>
                    <div style={{ fontSize: "0.82rem", color: "oklch(0.4 0.04 150)" }}>Sends: {t.sends2}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
