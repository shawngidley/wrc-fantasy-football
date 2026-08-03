/**
 * WRC Fantasy Football - Lineup Page
 * Background: Field turf
 * 10 starter slots + 8 bench spots, tap-to-swap on mobile
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, Lock, CheckCircle2 } from "lucide-react";

const STARTER_SLOTS = [
  { slot: "QB", label: "Quarterback" },
  { slot: "RB1", label: "Running Back" },
  { slot: "RB2", label: "Running Back" },
  { slot: "WR1", label: "Wide Receiver" },
  { slot: "WR2", label: "Wide Receiver" },
  { slot: "TE", label: "Tight End" },
  { slot: "SFLEX", label: "Super Flex" },
  { slot: "FLEX", label: "Flex" },
  { slot: "K", label: "Kicker" },
  { slot: "DST", label: "Defense / ST" },
];

const MOCK_STARTERS = [
  { slot: "QB", name: "Josh Allen", nflTeam: "BUF", pos: "QB", pts: 34.2, status: "Active" },
  { slot: "RB1", name: "Derrick Henry", nflTeam: "BAL", pos: "RB", pts: 18.6, status: "Active" },
  { slot: "RB2", name: "Saquon Barkley", nflTeam: "PHI", pos: "RB", pts: 22.4, status: "Active" },
  { slot: "WR1", name: "Tyreek Hill", nflTeam: "MIA", pos: "WR", pts: 14.8, status: "Active" },
  { slot: "WR2", name: "CeeDee Lamb", nflTeam: "DAL", pos: "WR", pts: 28.6, status: "Active" },
  { slot: "TE", name: "Sam LaPorta", nflTeam: "DET", pos: "TE", pts: 16.5, status: "Active" },
  { slot: "SFLEX", name: "Lamar Jackson", nflTeam: "BAL", pos: "QB", pts: 42.1, status: "Active" },
  { slot: "FLEX", name: "Jahmyr Gibbs", nflTeam: "DET", pos: "RB", pts: 19.8, status: "Active" },
  { slot: "K", name: "Harrison Butker", nflTeam: "KC", pos: "K", pts: 8.0, status: "Active" },
  { slot: "DST", name: "San Francisco", nflTeam: "SF", pos: "DST", pts: 12.0, status: "Active" },
];

const MOCK_BENCH = [
  { name: "Jaylen Waddle", nflTeam: "MIA", pos: "WR", pts: 11.2, status: "Active" },
  { name: "Tony Pollard", nflTeam: "TEN", pos: "RB", pts: 8.4, status: "Active" },
  { name: "Kyle Pitts", nflTeam: "ATL", pos: "TE", pts: 7.6, status: "Q" },
  { name: "Gus Edwards", nflTeam: "LAC", pos: "RB", pts: 4.2, status: "Active" },
  { name: "Elijah Moore", nflTeam: "CLE", pos: "WR", pts: 6.8, status: "Active" },
  { name: "Evan McPherson", nflTeam: "CIN", pos: "K", pts: 5.0, status: "Active" },
  { name: "Pittsburgh", nflTeam: "PIT", pos: "DST", pts: 9.0, status: "Active" },
  { name: "Tyjae Spears", nflTeam: "TEN", pos: "RB", pts: 3.6, status: "Active" },
];

const STATUS_COLORS: Record<string, string> = {
  Active: "oklch(0.42 0.15 150)",
  Q: "oklch(0.65 0.15 85)",
  D: "oklch(0.55 0.22 25)",
  OUT: "oklch(0.5 0.22 25)",
  IR: "oklch(0.5 0.22 25)",
};

const POS_COLORS: Record<string, string> = {
  QB: "oklch(0.55 0.18 260)",
  RB: "oklch(0.42 0.15 150)",
  WR: "oklch(0.55 0.18 220)",
  TE: "oklch(0.65 0.14 85)",
  K: "oklch(0.55 0.04 150)",
  DST: "oklch(0.5 0.18 25)",
};

export default function Lineup() {
  const { franchise } = useAuth();
  const [activeTab, setActiveTab] = useState<"starters" | "bench">("starters");
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lineupLocked = false;

  const totalPts = MOCK_STARTERS.reduce((s, p) => s + p.pts, 0);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="wrc-page-title" style={{ padding: 0 }}>
            <h1>My Lineup</h1>
            <p>{franchise?.team_name || "Select a team"} — Week 14 · Lock: Sun 1:00pm ET</p>
          </div>
          {lineupLocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.875rem" }}>
              <Lock size={14} color="#ef4444" />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", color: "#ef4444", letterSpacing: "0.04em" }}>LINEUP LOCKED</span>
            </div>
          ) : (
            <button onClick={handleSave} style={{
              background: saved ? "oklch(0.42 0.15 150)" : "oklch(0.28 0.09 150)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "0.5rem 1.25rem",
              fontFamily: "Oswald, sans-serif",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "background 0.2s",
            }}>
              {saved ? <><CheckCircle2 size={14} /> Saved!</> : "Save Lineup"}
            </button>
          )}
        </div>

        {/* Mobile Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {(["starters", "bench"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "0.6rem",
                background: activeTab === tab ? "oklch(0.28 0.09 150)" : "rgba(255,255,255,0.12)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.85rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              {tab === "starters" ? `Starters (${totalPts.toFixed(1)} pts)` : `Bench (${MOCK_BENCH.length})`}
            </button>
          ))}
        </div>

        {/* Desktop: side by side | Mobile: tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }} className="lineup-grid">
          {/* Starters */}
          <div style={{ display: activeTab === "starters" ? "block" : "none" }} className="lineup-starters">
            <div className="wrc-card">
              <div className="wrc-card-gold-stripe" />
              <div className="wrc-card-header">
                Starting Lineup
                <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.78 0.15 85)" }}>{totalPts.toFixed(1)} pts</span>
              </div>
              <div>
                {STARTER_SLOTS.map(({ slot, label }) => {
                  const player = MOCK_STARTERS.find(p => p.slot === slot);
                  const isSelected = selected === slot;
                  return (
                    <div
                      key={slot}
                      onClick={() => !lineupLocked && setSelected(isSelected ? null : slot)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.65rem 1rem",
                        borderBottom: "1px solid oklch(0.92 0.005 150)",
                        cursor: lineupLocked ? "default" : "pointer",
                        background: isSelected ? "oklch(0.94 0.03 150)" : "white",
                        transition: "background 0.12s",
                      }}
                    >
                      {/* Slot label */}
                      <div style={{
                        width: 44,
                        textAlign: "center",
                        fontFamily: "Oswald, sans-serif",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: "white",
                        background: POS_COLORS[player?.pos || "QB"] || "oklch(0.5 0.04 150)",
                        borderRadius: 4,
                        padding: "2px 0",
                        flexShrink: 0,
                      }}>
                        {slot}
                      </div>
                      {/* Player info */}
                      {player ? (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                            <div style={{ fontSize: "0.7rem", color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)", fontWeight: 600 }}>{player.status}</div>
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: 1, color: "oklch(0.7 0.02 150)", fontSize: "0.85rem", fontStyle: "italic" }}>Empty — {label}</div>
                      )}
                      {isSelected && <ArrowLeftRight size={14} color="oklch(0.28 0.09 150)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bench */}
          <div style={{ display: activeTab === "bench" ? "block" : "none" }} className="lineup-bench">
            <div className="wrc-card">
              <div className="wrc-card-gold-stripe" />
              <div className="wrc-card-header">Bench Players</div>
              <div>
                {MOCK_BENCH.map((player, i) => (
                  <div
                    key={i}
                    onClick={() => !lineupLocked && setSelected(selected === `bench-${i}` ? null : `bench-${i}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.65rem 1rem",
                      borderBottom: "1px solid oklch(0.92 0.005 150)",
                      cursor: lineupLocked ? "default" : "pointer",
                      background: selected === `bench-${i}` ? "oklch(0.94 0.03 150)" : "white",
                      transition: "background 0.12s",
                    }}
                  >
                    <div style={{
                      width: 44,
                      textAlign: "center",
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "white",
                      background: POS_COLORS[player.pos] || "oklch(0.5 0.04 150)",
                      borderRadius: 4,
                      padding: "2px 0",
                      flexShrink: 0,
                    }}>
                      {player.pos}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "oklch(0.18 0.05 150)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{player.pos} · {player.nflTeam}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1rem", color: "oklch(0.22 0.08 150)" }}>{player.pts.toFixed(1)}</div>
                      <div style={{ fontSize: "0.7rem", color: STATUS_COLORS[player.status] || "oklch(0.5 0.04 150)", fontWeight: 600 }}>{player.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .lineup-grid { grid-template-columns: 1fr 1fr !important; }
          .lineup-starters, .lineup-bench { display: block !important; }
        }
        @media (max-width: 768px) {
          .lineup-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
