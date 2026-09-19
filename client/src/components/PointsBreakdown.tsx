import { useState, useRef, useEffect } from "react";
import type { FantasyPointsBreakdownItem } from "@shared/scoringEngine";

/**
 * Wraps a player's live score. When the breakdown adds up to the score
 * shown (offense always does; kickers can differ because WRC's FG points
 * come from ESPN distance events the Tank01 line doesn't carry), the score
 * becomes a dotted-underline button that reveals how it was earned. When
 * the pieces don't reconcile, it just renders the score plainly rather than
 * showing math that doesn't add up.
 */
export function PointsBreakdown({
  items,
  total,
  align = "left",
  children,
}: {
  items: FantasyPointsBreakdownItem[];
  total: number;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const itemsSum = Math.round(items.reduce((t, i) => t + i.points, 0) * 10) / 10;
  const reconciles = items.length > 0 && Math.abs(itemsSum - Math.round(total * 10) / 10) <= 0.15;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!reconciles) return <>{children}</>;

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="How this score was earned"
        style={{
          background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer",
          textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "oklch(0.8 0.03 150)",
        }}
      >
        {children}
      </button>
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "100%", marginTop: 4, zIndex: 30,
            [align === "right" ? "right" : "left"]: 0,
            width: "max-content", minWidth: 168, maxWidth: 240,
            background: "white", border: "1px solid oklch(0.88 0.02 150)", borderRadius: 8,
            boxShadow: "0 8px 24px oklch(0.2 0.05 150 / 0.18)", padding: "0.4rem 0.5rem", textAlign: "left",
            cursor: "default",
          }}
        >
          {items.map((item, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.12rem 0", fontSize: "0.72rem", fontFamily: "Barlow Condensed, sans-serif" }}>
              <span style={{ color: "oklch(0.45 0.04 150)" }}>{item.label}</span>
              <span style={{ fontWeight: 800, color: item.points >= 0 ? "oklch(0.42 0.14 150)" : "oklch(0.5 0.2 25)" }}>{item.points > 0 ? "+" : ""}{item.points.toFixed(1)}</span>
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginTop: 3, paddingTop: 3, borderTop: "1px solid oklch(0.92 0.01 150)", fontSize: "0.72rem", fontFamily: "Barlow Condensed, sans-serif" }}>
            <span style={{ color: "oklch(0.3 0.05 150)", fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 800, color: "#e07b00" }}>{(Math.round(total * 10) / 10).toFixed(1)}</span>
          </span>
        </span>
      )}
    </span>
  );
}
