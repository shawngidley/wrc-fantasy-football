/**
 * WRC Fantasy Football - Playoffs Page
 * Background: Stadium crowd
 * 6-team bracket: Top 2 seeds get bye, Wild Card Round + Semifinals + Championship
 * Pre-season: seeds shown as TBD until regular season completes
 */
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy } from "lucide-react";

function BracketGame({ title, team1, team2, score1, score2, week }: {
  title: string;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  week: string;
}) {
  return (
    <div className="wrc-card" style={{ minWidth: 220 }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header" style={{ fontSize: "0.72rem" }}>{title} — {week}</div>
      <div className="wrc-card-body" style={{ padding: "0.75rem 1rem" }}>
        {[{ team: team1, score: score1 }, { team: team2, score: score2 }].map((t, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.5rem 0",
            borderBottom: i === 0 ? "1px solid oklch(0.9 0.005 150)" : "none",
          }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "oklch(0.22 0.06 150)" }}>{t.team}</span>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: t.score !== null ? "oklch(0.22 0.08 150)" : "oklch(0.75 0.01 150)" }}>
              {t.score !== null ? t.score.toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Playoffs() {
  const { franchise } = useAuth();

  return (
    <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.5rem" }}>
          <h1>2026 WRC Playoffs</h1>
          <p>6-team bracket — Weeks 15, 16 &amp; 17</p>
        </div>

        {/* Pre-season notice */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem", background: "oklch(0.97 0.04 85 / 0.15)", border: "1px solid oklch(0.75 0.12 85 / 0.4)" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "0.875rem 1.25rem", textAlign: "center" as const }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.55 0.16 85)", marginBottom: "0.35rem" }}>
              🏈 Season hasn't started yet
            </div>
            <div style={{ fontSize: "0.82rem", color: "oklch(0.35 0.04 150)" }}>
              Playoff seeds are determined after 14 weeks of regular season play (Sept. 9 – Dec. 15, 2026).
              The top 3 division winners plus the 3 best remaining records advance.
            </div>
          </div>
        </div>

        {/* Playoff Seeding Info */}
        <div className="wrc-card" style={{ marginBottom: "1.5rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-body" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Seeds 1–2 (Bye)</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>1. TBD — Division Winner</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>2. TBD — Division Winner</div>
              </div>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>Seeds 3–6 (Wild Card)</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>3. TBD — Division Winner</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>4. TBD — Wild Card</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>5. TBD — Wild Card</div>
                <div style={{ fontSize: "0.85rem", color: "oklch(0.3 0.04 150)" }}>6. TBD — Wild Card</div>
              </div>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.35 0.06 150)", marginBottom: "0.35rem" }}>12 Teams — 3 Divisions</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)" }}>East: Jonas Pattie, The Boys of Fall,</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)" }}>&nbsp;&nbsp;Heiden's Hardtimes, The Four Horsemen</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)", marginTop: 4 }}>Central: Keith Cromer, Legion of Doom,</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)" }}>&nbsp;&nbsp;Millertime, Billy Goats Gruff</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)", marginTop: 4 }}>West: Xavier Musketeers, Legends,</div>
                <div style={{ fontSize: "0.82rem", color: "oklch(0.3 0.04 150)" }}>&nbsp;&nbsp;Vipers, Larry "Bud" Melman123</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bracket */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center", minWidth: 800, padding: "0.5rem 0" }}>
            {/* Wild Card Round */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.7)", textAlign: "center" as const, marginBottom: "0.75rem" }}>
                Wild Card (Week 15)
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
                <BracketGame title="Game 1" team1="(3) TBD" team2="(6) TBD" score1={null} score2={null} week="Wk 15" />
                <BracketGame title="Game 2" team1="(4) TBD" team2="(5) TBD" score1={null} score2={null} week="Wk 15" />
              </div>
            </div>

            {/* Arrow */}
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.5rem" }}>→</div>

            {/* Semifinals */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.7)", textAlign: "center" as const, marginBottom: "0.75rem" }}>
                Semifinals (Week 16)
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
                <BracketGame title="SF 1" team1="(1) TBD" team2="WC Winner 1" score1={null} score2={null} week="Wk 16" />
                <BracketGame title="SF 2" team1="(2) TBD" team2="WC Winner 2" score1={null} score2={null} week="Wk 16" />
              </div>
            </div>

            {/* Arrow */}
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.5rem" }}>→</div>

            {/* Championship */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.7)", textAlign: "center" as const, marginBottom: "0.75rem" }}>
                Championship (Week 17)
              </div>
              <div className="wrc-card">
                <div style={{ background: "linear-gradient(90deg, oklch(0.65 0.14 85), oklch(0.72 0.15 85))", padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Trophy size={16} color="oklch(0.15 0.02 150)" />
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "oklch(0.15 0.02 150)" }}>WRC Championship</span>
                </div>
                <div className="wrc-card-body" style={{ padding: "0.75rem 1rem" }}>
                  {["SF Winner 1", "SF Winner 2"].map((t, i) => (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0",
                      borderBottom: i === 0 ? "1px solid oklch(0.9 0.005 150)" : "none",
                    }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "oklch(0.22 0.06 150)" }}>{t}</span>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "oklch(0.75 0.01 150)" }}>—</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
