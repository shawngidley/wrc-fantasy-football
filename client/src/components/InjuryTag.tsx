import { getInjuryColor, getInjuryLabel } from "@/hooks/useNFLInjuries";

/**
 * The one injury pill used across the site (Rosters, Lineup, Live Scoring,
 * Free Agents, the player card, and the Standings news panels), so a
 * designation always looks and reads the same wherever a player's name
 * appears. Renders nothing for a healthy player or an empty/"active"
 * status, so callers can drop it in next to any name unconditionally.
 */
export function InjuryTag({ designation, size = "sm" }: { designation: string | null | undefined; size?: "sm" | "xs" }) {
  const d = (designation ?? "").trim();
  if (!d || d.toLowerCase() === "active" || d.toLowerCase() === "healthy") return null;
  const color = getInjuryColor(d);
  if (!color) return null;
  return (
    <span
      title={d}
      style={{
        fontSize: size === "xs" ? "0.56rem" : "0.6rem",
        fontWeight: 700,
        fontFamily: "Barlow Condensed, sans-serif",
        letterSpacing: "0.02em",
        padding: "1px 4px",
        borderRadius: 3,
        flexShrink: 0,
        lineHeight: 1.2,
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      {getInjuryLabel(d)}
    </span>
  );
}
