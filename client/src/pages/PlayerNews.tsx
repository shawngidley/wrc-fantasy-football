import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Search, AlertTriangle, Activity } from "lucide-react";

const NEWS = [
  { player: "Justin Jefferson", team: "MIN", pos: "WR", status: "Q", headline: "Questionable with hamstring — limited practice Wednesday", time: "2h ago", source: "ESPN" },
  { player: "Tyreek Hill", team: "MIA", pos: "WR", status: "OUT", headline: "Ruled out Sunday with ankle injury, missed full practice", time: "3h ago", source: "Rotowire" },
  { player: "Derrick Henry", team: "BAL", pos: "RB", status: "Active", headline: "Full practice participant, no injury designation", time: "4h ago", source: "ESPN" },
  { player: "Travis Kelce", team: "KC", pos: "TE", status: "Q", headline: "Questionable with knee — limited practice Thursday", time: "5h ago", source: "ESPN" },
  { player: "CeeDee Lamb", team: "DAL", pos: "WR", status: "Active", headline: "No injury designation, full practice all week", time: "6h ago", source: "Rotowire" },
  { player: "Saquon Barkley", team: "PHI", pos: "RB", status: "Active", headline: "Full practice, expected to play full workload Sunday", time: "8h ago", source: "ESPN" },
  { player: "Sam LaPorta", team: "DET", pos: "TE", status: "Q", headline: "Questionable with shoulder, limited Wednesday", time: "10h ago", source: "Rotowire" },
  { player: "Josh Allen", team: "BUF", pos: "QB", status: "Active", headline: "No injury concerns, full practice participant all week", time: "12h ago", source: "ESPN" },
];

const STATUS_COLORS: Record<string, string> = {
  Active: "oklch(0.42 0.15 150)", Q: "oklch(0.65 0.14 85)", D: "oklch(0.55 0.22 25)", OUT: "oklch(0.5 0.22 25)",
};

export default function PlayerNews() {
  const { franchise } = useAuth();
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = NEWS.filter(n => {
    const matchSearch = n.player.toLowerCase().includes(search.toLowerCase()) || n.team.toLowerCase().includes(search.toLowerCase());
    const matchTeam = teamFilter === "ALL" || n.team === teamFilter;
    const matchStatus = statusFilter === "ALL" || n.status === statusFilter;
    return matchSearch && matchTeam && matchStatus;
  });

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.25rem" }}>
          <h1>Player News</h1>
          <p>NFL injury updates and player news — powered by ESPN</p>
        </div>

        {/* Filters */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-body" style={{ padding: "0.875rem 1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..." style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", background: "white", cursor: "pointer", outline: "none" }}>
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Q">Questionable</option>
              <option value="OUT">Out</option>
            </select>
          </div>
        </div>

        {/* News Feed */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header"><Activity size={14} /> Latest Updates</div>
          <div>
            {filtered.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "0.875rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid oklch(0.92 0.005 150)", alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {item.status !== "Active" ? <AlertTriangle size={16} color={STATUS_COLORS[item.status]} /> : <Activity size={16} color="oklch(0.42 0.15 150)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{item.player}</span>
                    <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{item.pos} · {item.team}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_COLORS[item.status] || "oklch(0.5 0.04 150)", background: `${STATUS_COLORS[item.status]}18`, borderRadius: 4, padding: "1px 6px" }}>{item.status}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "oklch(0.35 0.04 150)", lineHeight: 1.5 }}>{item.headline}</p>
                  <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)", marginTop: "0.25rem" }}>{item.source} · {item.time}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "oklch(0.6 0.04 150)" }}>No news found</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
