/**
 * WRC Fantasy Football - Money Page
 * Background: Field turf
 * Sections: Money Owed (editable by commish), Prize Structure, GOW History, 2026 Earnings
 * Supabase tables: money_owed, gow_history, earnings
 */
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ─── Static data (fallback until Supabase is connected) ─────────────────────

const DEFAULT_OWNERS = [
  { id: "shawn",    name: "Shawn",    owed: 0.00 },
  { id: "greg",     name: "Greg",     owed: 0.00 },
  { id: "jonas",    name: "Jonas",    owed: 0.00 },
  { id: "jamie",    name: "Jamie",    owed: 0.00 },
  { id: "bill",     name: "Bill",     owed: 0.00 },
  { id: "scottm",   name: "Scott M.", owed: 0.00 },
  { id: "davids",   name: "David S.", owed: 0.00 },
  { id: "davidr",   name: "David R.", owed: 0.00 },
  { id: "scottn",   name: "Scott N.", owed: 0.00 },
  { id: "jason",    name: "Jason",    owed: 0.00 },
  { id: "keith",    name: "Keith",    owed: 0.00 },
  { id: "dan",      name: "Dan",      owed: 0.00 },
];

const PRIZE_STRUCTURE = [
  { place: "Champion",         players: 1,  perPlayer: 600.00, total: 600.00  },
  { place: "Super Bowl",       players: 2,  perPlayer: 300.00, total: 600.00  },
  { place: "Divisional Round", players: 4,  perPlayer: 100.00, total: 400.00  },
  { place: "Wild Card Round",  players: 6,  perPlayer: 50.00,  total: 300.00  },
  { place: "Game of the Week", players: 12, perPlayer: 30.00,  total: 360.00  },
];

const TOTAL_POOL = 2260.00;
const WEBSITE_FEE = 140.00;

type Earnings = {
  name: string;
  gow: number | null;
  wildCard: number | null;
  divisional: number | null;
  superBowl: number | null;
  champ: number | null;
};

const DEFAULT_EARNINGS: Earnings[] = [
  { name: "Shawn",    gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Greg",     gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Jonas",    gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Jamie",    gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Bill",     gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Scott M.", gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "David S.", gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "David R.", gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Scott N.", gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Jason",    gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Keith",    gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
  { name: "Dan",      gow: null, wildCard: null, divisional: null, superBowl: null, champ: null },
];

type GowEntry = {
  id?: string;
  week: number;
  winner: string;
  team: string;
  opponent: string;
  score: string;
  amount: number;
};

const DEFAULT_GOW: GowEntry[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val: number | null) {
  if (val === null) return <span style={{ color: "oklch(0.72 0.02 150)" }}>—</span>;
  return `$${val.toFixed(2)}`;
}

function earningsTotal(e: Earnings) {
  return (e.gow ?? 0) + (e.wildCard ?? 0) + (e.divisional ?? 0) + (e.superBowl ?? 0) + (e.champ ?? 0);
}

const cell: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  textAlign: "right",
  fontSize: "0.82rem",
  borderBottom: "1px solid oklch(0.93 0.01 150)",
  color: "oklch(0.25 0.06 150)",
};

const hdr: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "right",
  fontSize: "0.72rem",
  fontFamily: "Barlow Condensed, sans-serif",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "oklch(0.38 0.09 150)",
  background: "oklch(0.96 0.01 150)",
  borderBottom: "2px solid oklch(0.88 0.03 150)",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "Barlow Condensed, sans-serif",
  fontWeight: 700,
  fontSize: "1rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "oklch(0.22 0.07 150)",
  marginBottom: "0.75rem",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Money() {
  const { franchise, isCommissioner } = useAuth();

  // Money Owed state
  const [owners, setOwners] = useState(DEFAULT_OWNERS);
  const [editMode, setEditMode] = useState(false);
  const [editOwed, setEditOwed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // GOW History state
  const [gowHistory, setGowHistory] = useState<GowEntry[]>(DEFAULT_GOW);
  const [gowEditMode, setGowEditMode] = useState(false);
  const [editingGow, setEditingGow] = useState<GowEntry | null>(null);
  const [showGowForm, setShowGowForm] = useState(false);

  // Earnings state
  const [earnings, setEarnings] = useState<Earnings[]>(DEFAULT_EARNINGS);

  // ── Load from Supabase ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    // Money Owed — columns: id, name, owed
    const { data: owedData } = await supabase.from("money_owed").select("id, name, owed");
    if (owedData && owedData.length > 0) {
      setOwners(owedData.map((r: { id: string; name: string; owed: number }) => ({
        id: r.id, name: r.name, owed: r.owed ?? 0,
      })));
    }

    // GOW History — columns: id, week, winner, team, opponent, score, amount, season
    const { data: gowData } = await supabase.from("gow_history").select("*").order("week");
    if (gowData && gowData.length > 0) setGowHistory(gowData);

    // Earnings — columns: id, name, gow, wild_card, divisional, super_bowl, champ, season
    const { data: earnData } = await supabase.from("earnings").select("*");
    if (earnData && earnData.length > 0) {
      setEarnings(earnData.map((r: { id: string; name: string; gow: number | null; wild_card: number | null; divisional: number | null; super_bowl: number | null; champ: number | null }) => ({
        name: r.name,
        gow: r.gow ?? null,
        wildCard: r.wild_card ?? null,
        divisional: r.divisional ?? null,
        superBowl: r.super_bowl ?? null,
        champ: r.champ ?? null,
      })));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Commissioner: Save Money Owed ───────────────────────────────────────────
  const enterEditMode = () => {
    const map: Record<string, string> = {};
    owners.forEach(o => { map[o.id] = o.owed.toFixed(2); });
    setEditOwed(map);
    setEditMode(true);
    setSaveMsg("");
  };

  const saveOwed = async () => {
    setSaving(true);
    const updates = owners.map(o => ({
      id: o.id,
      name: o.name,
      owed: parseFloat(editOwed[o.id] ?? "0") || 0,
    }));

    // Try Supabase upsert; fall back to local state if not connected
    const { error } = await supabase.from("money_owed").upsert(updates, { onConflict: "id" });
    if (!error) {
      setOwners(prev => prev.map(o => ({ ...o, owed: parseFloat(editOwed[o.id] ?? "0") || 0 })));
      setSaveMsg("Saved successfully.");
    } else {
      setOwners(prev => prev.map(o => ({ ...o, owed: parseFloat(editOwed[o.id] ?? "0") || 0 })));
      setSaveMsg("Saved locally (Supabase not connected).");
    }
    setEditMode(false);
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  // ── Commissioner: GOW entry ──────────────────────────────────────────────────
  const saveGowEntry = async (entry: GowEntry) => {
    const { error } = await supabase.from("gow_history").upsert({ ...entry, season: 2026 }, { onConflict: "week,season" });
    if (!error) {
      setGowHistory(prev => {
        const idx = prev.findIndex(g => g.week === entry.week);
        if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
        return [...prev, entry].sort((a, b) => a.week - b.week);
      });
    } else {
      // Offline fallback
      setGowHistory(prev => {
        const idx = prev.findIndex(g => g.week === entry.week);
        if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
        return [...prev, entry].sort((a, b) => a.week - b.week);
      });
    }
    setEditingGow(null);
    setShowGowForm(false);
  };

  const totalGowPaid = gowHistory.reduce((s, g) => s + g.amount, 0);

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.5rem" }}>
          <h1>Money</h1>
          <p>2026 Season — Entry Fees, Prize Structure &amp; Earnings</p>
        </div>

        {/* ── SECTION 1: Money Owed ─────────────────────────────────────────── */}
        <div className="wrc-card" style={{ marginBottom: "1.75rem", overflowX: "auto" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "0.85rem 1rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={sectionTitle}>Money Owed</h2>
            {isCommissioner && !editMode && (
              <button
                onClick={enterEditMode}
                style={{
                  background: "oklch(0.32 0.1 150)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "0.35rem 0.9rem",
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                ✏ Edit Balances
              </button>
            )}
            {isCommissioner && editMode && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={saveOwed}
                  disabled={saving}
                  style={{
                    background: "oklch(0.32 0.1 150)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.35rem 0.9rem",
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving…" : "✓ Save"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    background: "oklch(0.92 0.01 150)",
                    color: "oklch(0.35 0.06 150)",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.35rem 0.9rem",
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {saveMsg && (
            <div style={{ padding: "0 1rem 0.5rem", fontSize: "0.75rem", color: "oklch(0.38 0.12 150)", fontStyle: "italic" }}>
              {saveMsg}
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...hdr, textAlign: "left", paddingLeft: "1rem" }}>Category</th>
                {owners.map(o => (
                  <th key={o.id} style={hdr}>{o.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>Entry Fee*</td>
                {owners.map(o => (
                  <td key={o.id} style={{ ...cell, color: o.owed > 0 ? "oklch(0.45 0.18 25)" : "oklch(0.38 0.14 150)", fontWeight: o.owed > 0 ? 700 : 400 }}>
                    {o.owed > 0 ? `$${o.owed.toFixed(0)}` : <span style={{ color: "oklch(0.42 0.14 150)", fontSize: "0.7rem", fontWeight: 600 }}>PAID</span>}
                  </td>
                ))}
              </tr>
              <tr style={{ background: "oklch(0.97 0.01 150)" }}>
                <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>
                  Total Money Owed
                </td>
                {owners.map(o => (
                  <td key={o.id} style={{ ...cell, fontWeight: 700 }}>
                    {editMode ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editOwed[o.id] ?? "0.00"}
                        onChange={e => setEditOwed(prev => ({ ...prev, [o.id]: e.target.value }))}
                        style={{
                          width: 64,
                          textAlign: "right",
                          border: "1px solid oklch(0.75 0.08 150)",
                          borderRadius: 4,
                          padding: "0.15rem 0.3rem",
                          fontSize: "0.8rem",
                          color: "oklch(0.25 0.06 150)",
                          background: "white",
                        }}
                      />
                    ) : (
                      <span style={{ color: o.owed > 0 ? "oklch(0.45 0.18 25)" : "oklch(0.25 0.06 150)" }}>
                        ${o.owed.toFixed(2)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div style={{ padding: "0.5rem 1rem 0.85rem" }}>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic" }}>*includes website</span>
          </div>
        </div>

        {/* ── Paid for 2027 badge — compact, under the fees table ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", padding: "0.6rem 1rem", background: "white", border: "1.5px solid oklch(0.75 0.04 150)", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flexWrap: "wrap" as const }}>
          <span style={{ fontSize: "0.9rem", color: "oklch(0.65 0.04 150)", flexShrink: 0 }}>○</span>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "oklch(0.28 0.08 85)", flexShrink: 0 }}>Paid for 2027:</span>
          <span style={{ fontSize: "0.8rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic" }}>
            No owners have paid yet
          </span>
        </div>

        {/* ── SECTION 2: Prize Structure ───────────────────────────────────── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="wrc-card" style={{ overflowX: "auto" }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{ padding: "0.85rem 1rem 0.5rem" }}>
              <h2 style={sectionTitle}>Prize Structure</h2>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...hdr, textAlign: "left", paddingLeft: "1rem" }}>Category</th>
                  <th style={hdr}>Per Player</th>
                  <th style={hdr}># Players</th>
                  <th style={hdr}>Total</th>
                </tr>
              </thead>
              <tbody>
                {PRIZE_STRUCTURE.map((row, i) => (
                  <tr key={row.place} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                    <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>{row.place}</td>
                    <td style={cell}>${row.perPlayer.toFixed(2)}</td>
                    <td style={{ ...cell, textAlign: "center" }}>{row.players}</td>
                    <td style={{ ...cell, fontWeight: 700, color: "oklch(0.28 0.12 150)" }}><strong>${row.total.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "oklch(0.96 0.01 150)" }}>
                  <td colSpan={3} style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>Total Prize Pool</td>
                  <td style={{ ...cell, fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.12 150)" }}><strong>${TOTAL_POOL.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ ...cell, textAlign: "left", paddingLeft: "1rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic", fontSize: "0.75rem" }}>Website fee</td>
                  <td style={{ ...cell, color: "oklch(0.55 0.04 150)", fontStyle: "italic", fontSize: "0.75rem" }}>${WEBSITE_FEE.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── SECTION 3: Game of the Week History ───────────────────────────── */}
        <div className="wrc-card" style={{ marginBottom: "1.75rem", overflowX: "auto" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "0.85rem 1rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={sectionTitle}>Game of the Week History</h2>
              <p style={{ fontSize: "0.75rem", color: "oklch(0.52 0.04 150)", margin: 0 }}>
                Highest-scoring matchup each week · $30.00 per winner
              </p>
            </div>
            {isCommissioner && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => { setGowEditMode(!gowEditMode); setEditingGow(null); setShowGowForm(false); }}
                  style={{
                    background: gowEditMode ? "oklch(0.92 0.01 150)" : "oklch(0.32 0.1 150)",
                    color: gowEditMode ? "oklch(0.35 0.06 150)" : "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.35rem 0.9rem",
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {gowEditMode ? "Done Editing" : "✏ Edit"}
                </button>
                {gowEditMode && (
                  <button
                    onClick={() => { setEditingGow({ week: gowHistory.length + 1, winner: "", team: "", opponent: "", score: "", amount: 30 }); setShowGowForm(true); }}
                    style={{
                      background: "oklch(0.78 0.15 85)",
                      color: "oklch(0.18 0.05 85)",
                      border: "none",
                      borderRadius: 6,
                      padding: "0.35rem 0.9rem",
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    + Add Week
                  </button>
                )}
              </div>
            )}
          </div>

          {/* GOW Add/Edit Form */}
          {showGowForm && editingGow && (
            <div style={{ margin: "0 1rem 1rem", padding: "1rem", background: "oklch(0.97 0.01 150)", borderRadius: 8, border: "1px solid oklch(0.88 0.03 150)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem", marginBottom: "0.75rem" }}>
                {[
                  { label: "Week", key: "week", type: "number" },
                  { label: "Winner (Owner)", key: "winner", type: "text" },
                  { label: "Team Name", key: "team", type: "text" },
                  { label: "Opponent", key: "opponent", type: "text" },
                  { label: "Score", key: "score", type: "text" },
                  { label: "Amount ($)", key: "amount", type: "number" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "oklch(0.4 0.07 150)", display: "block", marginBottom: "0.2rem" }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={(editingGow as Record<string, unknown>)[f.key] as string ?? ""}
                      onChange={e => setEditingGow(prev => prev ? { ...prev, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value } : prev)}
                      style={{ width: "100%", border: "1px solid oklch(0.82 0.04 150)", borderRadius: 4, padding: "0.3rem 0.5rem", fontSize: "0.82rem", color: "oklch(0.25 0.06 150)" }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => saveGowEntry(editingGow)}
                  style={{ background: "oklch(0.32 0.1 150)", color: "white", border: "none", borderRadius: 6, padding: "0.35rem 1rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  ✓ Save Entry
                </button>
                <button
                  onClick={() => { setShowGowForm(false); setEditingGow(null); }}
                  style={{ background: "oklch(0.92 0.01 150)", color: "oklch(0.35 0.06 150)", border: "none", borderRadius: 6, padding: "0.35rem 1rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ ...hdr, textAlign: "center", width: 56 }}>Wk</th>
                <th style={{ ...hdr, textAlign: "left", paddingLeft: "1rem" }}>Winner</th>
                <th style={{ ...hdr, textAlign: "left" }}>Team</th>
                <th style={{ ...hdr, textAlign: "left" }}>Opponent</th>
                <th style={hdr}>Score</th>
                <th style={hdr}>Prize</th>
                {gowEditMode && <th style={hdr}>Edit</th>}
              </tr>
            </thead>
            <tbody>
              {gowHistory.map((g, i) => (
                <tr key={g.week} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                  <td style={{ ...cell, textAlign: "center", fontWeight: 700, color: "oklch(0.35 0.09 150)" }}>{g.week}</td>
                  <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>{g.winner}</td>
                  <td style={{ ...cell, textAlign: "left" }}>{g.team}</td>
                  <td style={{ ...cell, textAlign: "left", color: "oklch(0.48 0.04 150)" }}>{g.opponent}</td>
                  <td style={{ ...cell, fontFamily: "monospace", fontSize: "0.8rem" }}>{g.score}</td>
                  <td style={{ ...cell, fontWeight: 700, color: "oklch(0.28 0.12 150)" }}>${g.amount.toFixed(2)}</td>
                  {gowEditMode && (
                    <td style={{ ...cell, textAlign: "center" }}>
                      <button
                        onClick={() => { setEditingGow(g); setShowGowForm(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.38 0.09 150)", fontSize: "0.8rem", padding: "0.1rem 0.3rem" }}
                      >
                        ✏
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "oklch(0.96 0.01 150)" }}>
                <td colSpan={gowEditMode ? 5 : 4} style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>
                  Total GOW Paid
                </td>
                <td style={{ ...cell, fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.12 150)" }}>
                  ${totalGowPaid.toFixed(2)}
                </td>
                {gowEditMode && <td style={cell} />}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── SECTION 4: 2026 Earnings ──────────────────────────────────────── */}
        <div className="wrc-card" style={{ overflowX: "auto" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "0.85rem 1rem 0.5rem" }}>
            <h2 style={sectionTitle}>2026 Earnings</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...hdr, textAlign: "left", paddingLeft: "1rem" }}>Owner</th>
                <th style={hdr}>Game of Week</th>
                <th style={hdr}>Wild Card</th>
                <th style={hdr}>Divisional</th>
                <th style={hdr}>Super Bowl</th>
                <th style={hdr}>Champion</th>
                <th style={{ ...hdr, color: "oklch(0.28 0.12 150)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((e, i) => {
                const rowTotal = earningsTotal(e);
                return (
                  <tr key={e.name} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                    <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>{e.name}</td>
                    <td style={cell}>{fmt(e.gow)}</td>
                    <td style={cell}>{fmt(e.wildCard)}</td>
                    <td style={cell}>{fmt(e.divisional)}</td>
                    <td style={cell}>{fmt(e.superBowl)}</td>
                    <td style={cell}>{fmt(e.champ)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: rowTotal > 0 ? "oklch(0.28 0.12 150)" : "oklch(0.72 0.02 150)" }}>
                      {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "oklch(0.96 0.01 150)" }}>
                <td style={{ ...cell, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>Total Paid Out</td>
                <td style={{ ...cell, fontWeight: 700 }}>${earnings.reduce((s, e) => s + (e.gow ?? 0), 0).toFixed(2)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>${earnings.reduce((s, e) => s + (e.wildCard ?? 0), 0).toFixed(2)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>${earnings.reduce((s, e) => s + (e.divisional ?? 0), 0).toFixed(2)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>${earnings.reduce((s, e) => s + (e.superBowl ?? 0), 0).toFixed(2)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>${earnings.reduce((s, e) => s + (e.champ ?? 0), 0).toFixed(2)}</td>
                <td style={{ ...cell, fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.12 150)" }}>
                  ${earnings.reduce((s, e) => s + earningsTotal(e), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  );
}
