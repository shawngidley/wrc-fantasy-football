/**
 * WRC Fantasy Football - Money Page
 * Background: Field turf
 * Three sections: Money Owed per owner, Prize Structure, 2025 Earnings breakdown
 */
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const OWNERS = [
  { name: "Shawn",   owed: 0.00 },
  { name: "Greg",    owed: 0.00 },
  { name: "Jonas",   owed: 0.00 },
  { name: "Jamie",   owed: 0.00 },
  { name: "Bill",    owed: 0.00 },
  { name: "Scott M.", owed: 0.00 },
  { name: "David S.", owed: 0.00 },
  { name: "David R.", owed: 0.00 },
  { name: "Scott N.", owed: 0.00 },
  { name: "Jason",   owed: 0.00 },
  { name: "Keith",   owed: 0.00 },
  { name: "Dan",     owed: 0.00 },
];

const PRIZE_STRUCTURE = [
  { place: "Champion",        players: 1,  perPlayer: 600.00, total: 600.00  },
  { place: "Super Bowl",      players: 2,  perPlayer: 300.00, total: 600.00  },
  { place: "Divisional Round",players: 4,  perPlayer: 100.00, total: 400.00  },
  { place: "Wild Card Round", players: 6,  perPlayer: 50.00,  total: 300.00  },
  { place: "Game of the Week",players: 12, perPlayer: 30.00,  total: 360.00  },
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

const EARNINGS_2025: Earnings[] = [
  { name: "Shawn",    gow: 30.00, wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Greg",     gow: 30.00, wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Jonas",    gow: 30.00, wildCard: 50.00, divisional: null,   superBowl: null,   champ: null   },
  { name: "Jamie",    gow: 30.00, wildCard: 50.00, divisional: 100.00, superBowl: null,   champ: null   },
  { name: "Bill",     gow: 30.00, wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Scott M.", gow: 30.00, wildCard: 50.00, divisional: 100.00, superBowl: 300.00, champ: null   },
  { name: "David S.", gow: 30.00, wildCard: 50.00, divisional: null,   superBowl: null,   champ: null   },
  { name: "David R.", gow: null,  wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Scott N.", gow: null,  wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Jason",    gow: 30.00, wildCard: null,  divisional: null,   superBowl: null,   champ: null   },
  { name: "Keith",    gow: 60.00, wildCard: 50.00, divisional: 100.00, superBowl: null,   champ: null   },
  { name: "Dan",      gow: 60.00, wildCard: 50.00, divisional: 100.00, superBowl: 300.00, champ: 600.00 },
];

function fmt(val: number | null) {
  if (val === null) return <span style={{ color: "oklch(0.7 0.02 150)" }}>—</span>;
  return `$${val.toFixed(2)}`;
}

function total(e: Earnings) {
  return (e.gow ?? 0) + (e.wildCard ?? 0) + (e.divisional ?? 0) + (e.superBowl ?? 0) + (e.champ ?? 0);
}

const cellStyle: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  textAlign: "right",
  fontSize: "0.82rem",
  borderBottom: "1px solid oklch(0.93 0.01 150)",
  color: "oklch(0.25 0.06 150)",
};

const headerCellStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "right",
  fontSize: "0.72rem",
  fontFamily: "Oswald, sans-serif",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "oklch(0.38 0.09 150)",
  background: "oklch(0.96 0.01 150)",
  borderBottom: "2px solid oklch(0.88 0.03 150)",
};

export default function Money() {
  const { franchise } = useAuth();

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation teamName={franchise?.team_name} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Page Title */}
        <div className="wrc-page-title" style={{ padding: "1rem 0 1.5rem" }}>
          <h1>Money</h1>
          <p>2025 Season — Entry Fees, Prize Structure &amp; Earnings</p>
        </div>

        {/* ── SECTION 1: Money Owed ───────────────────────────── */}
        <div className="wrc-card" style={{ marginBottom: "1.75rem", overflowX: "auto" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "0.85rem 1rem 0.5rem" }}>
            <h2 style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "oklch(0.22 0.07 150)",
              marginBottom: "0.75rem",
            }}>
              Money Owed
            </h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: "left", paddingLeft: "1rem" }}>Category</th>
                {OWNERS.map(o => (
                  <th key={o.name} style={headerCellStyle}>{o.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>
                  Entry Fee*
                </td>
                {OWNERS.map(o => (
                  <td key={o.name} style={cellStyle}>$&nbsp;—</td>
                ))}
              </tr>
              <tr style={{ background: "oklch(0.97 0.01 150)" }}>
                <td style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>
                  Total Money Owed
                </td>
                {OWNERS.map(o => (
                  <td key={o.name} style={{ ...cellStyle, fontWeight: 700, color: o.owed > 0 ? "oklch(0.45 0.18 25)" : "oklch(0.25 0.06 150)" }}>
                    ${o.owed.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div style={{ padding: "0.5rem 1rem 0.85rem" }}>
            <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic" }}>
              *includes website
            </span>
          </div>
        </div>

        {/* ── SECTION 2: Prize Structure ──────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.75rem" }}>

          {/* Prize breakdown table */}
          <div className="wrc-card" style={{ overflowX: "auto" }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{ padding: "0.85rem 1rem 0.5rem" }}>
              <h2 style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "oklch(0.22 0.07 150)",
                marginBottom: "0.75rem",
              }}>
                Prize Structure
              </h2>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, textAlign: "left", paddingLeft: "1rem" }}>Category</th>
                  <th style={headerCellStyle}>Per Player</th>
                  <th style={headerCellStyle}># Players</th>
                  <th style={headerCellStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {PRIZE_STRUCTURE.map((row, i) => (
                  <tr key={row.place} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                    <td style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>{row.place}</td>
                    <td style={cellStyle}>${row.perPlayer.toFixed(2)}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{row.players}</td>
                    <td style={{ ...cellStyle, fontWeight: 700, color: "oklch(0.28 0.12 150)" }}>
                      <strong>${row.total.toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "oklch(0.96 0.01 150)" }}>
                  <td colSpan={3} style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>
                    Total Prize Pool
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.12 150)" }}>
                    <strong>${TOTAL_POOL.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", color: "oklch(0.55 0.04 150)", fontStyle: "italic", fontSize: "0.75rem" }}>
                    Website fee
                  </td>
                  <td style={{ ...cellStyle, color: "oklch(0.55 0.04 150)", fontStyle: "italic", fontSize: "0.75rem" }}>
                    ${WEBSITE_FEE.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Paid for 2026 badge */}
          <div className="wrc-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem", minHeight: 180 }}>
            <div className="wrc-card-gold-stripe" />
            <div style={{
              background: "oklch(0.78 0.15 85)",
              color: "oklch(0.18 0.05 85)",
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: "1.4rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.75rem 2rem",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              marginBottom: "0.75rem",
            }}>
              ✓ Paid for 2026
            </div>
            <p style={{ fontSize: "0.8rem", color: "oklch(0.5 0.04 150)", textAlign: "center", margin: 0 }}>
              All entry fees collected for the 2026 season
            </p>
          </div>
        </div>

        {/* ── SECTION 3: 2025 Earnings ────────────────────────── */}
        <div className="wrc-card" style={{ overflowX: "auto" }}>
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "0.85rem 1rem 0.5rem" }}>
            <h2 style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "oklch(0.22 0.07 150)",
              marginBottom: "0.75rem",
            }}>
              2025 Earnings
            </h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: "left", paddingLeft: "1rem" }}>Owner</th>
                <th style={headerCellStyle}>Game of Week</th>
                <th style={headerCellStyle}>Wild Card</th>
                <th style={headerCellStyle}>Divisional</th>
                <th style={headerCellStyle}>Super Bowl</th>
                <th style={headerCellStyle}>Champion</th>
                <th style={{ ...headerCellStyle, color: "oklch(0.28 0.12 150)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {EARNINGS_2025.map((e, i) => {
                const rowTotal = total(e);
                return (
                  <tr key={e.name} style={{ background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 150)" }}>
                    <td style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 600 }}>{e.name}</td>
                    <td style={cellStyle}>{fmt(e.gow)}</td>
                    <td style={cellStyle}>{fmt(e.wildCard)}</td>
                    <td style={cellStyle}>{fmt(e.divisional)}</td>
                    <td style={cellStyle}>{fmt(e.superBowl)}</td>
                    <td style={cellStyle}>{fmt(e.champ)}</td>
                    <td style={{
                      ...cellStyle,
                      fontWeight: 700,
                      color: rowTotal > 0 ? "oklch(0.28 0.12 150)" : "oklch(0.7 0.02 150)",
                    }}>
                      {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "oklch(0.96 0.01 150)" }}>
                <td style={{ ...cellStyle, textAlign: "left", paddingLeft: "1rem", fontWeight: 700, color: "oklch(0.18 0.07 150)" }}>
                  Total Paid Out
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  ${EARNINGS_2025.reduce((s, e) => s + (e.gow ?? 0), 0).toFixed(2)}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  ${EARNINGS_2025.reduce((s, e) => s + (e.wildCard ?? 0), 0).toFixed(2)}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  ${EARNINGS_2025.reduce((s, e) => s + (e.divisional ?? 0), 0).toFixed(2)}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  ${EARNINGS_2025.reduce((s, e) => s + (e.superBowl ?? 0), 0).toFixed(2)}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  ${EARNINGS_2025.reduce((s, e) => s + (e.champ ?? 0), 0).toFixed(2)}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.22 0.12 150)" }}>
                  ${EARNINGS_2025.reduce((s, e) => s + total(e), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  );
}
