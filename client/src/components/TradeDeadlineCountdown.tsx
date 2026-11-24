import { useEffect, useState } from "react";
import { Link } from "wouter";
import { TRADE_DEADLINE_LABEL, countdownParts, isTradeDeadlinePassed } from "@shared/tradeDeadline";

const pad = (n: number) => String(n).padStart(2, "0");

/** Live countdown to the trade deadline, shown to everyone on the Standings page. */
export default function TradeDeadlineCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Nothing left to count: don't tick once the deadline is behind us, or every
    // visit to Standings re-renders this once a second for the rest of the
    // season to redraw an unchanging line of text. A page open ACROSS the
    // deadline still flips, because its interval started while time remained.
    if (isTradeDeadlinePassed()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const passed = isTradeDeadlinePassed(now);
  const { days, hours, minutes, seconds } = countdownParts(now);
  const urgent = !passed && days === 0 && hours < 3;
  const units: Array<[string, string]> = [[String(days), "days"], [pad(hours), "hrs"], [pad(minutes), "min"], [pad(seconds), "sec"]];

  return (
    <Link href="/trades" style={{ textDecoration: "none", display: "block", marginBottom: "1rem" }}>
      <div
        role="timer"
        aria-label={passed ? "The trade deadline has passed" : "Time until the trade deadline"}
        style={{
          background: urgent ? "oklch(0.35 0.14 25)" : "oklch(0.22 0.06 150)",
          border: "1px solid oklch(0.78 0.15 85)", borderRadius: 12, padding: "0.8rem 1rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(0.88 0.15 85)" }}>
            {passed ? "Trade deadline has passed" : "Trade deadline countdown"}
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.75)" }}>
            {passed ? `Trades closed ${TRADE_DEADLINE_LABEL}` : `${TRADE_DEADLINE_LABEL}. A trade must be accepted before then.`}
          </div>
        </div>
        {!passed && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {units.map(([value, label]) => (
              <div key={label} style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.6rem", lineHeight: 1, color: "white", fontVariantNumeric: "tabular-nums" }}>{value}</div>
                <div style={{ fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
