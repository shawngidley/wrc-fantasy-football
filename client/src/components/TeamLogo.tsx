/**
 * WRC Fantasy Football - TeamLogo Component
 * Renders a team logo image with fallback to initials avatar.
 * Uses the CDN-hosted logos from teamLogos.ts.
 */
import { getTeamLogo } from "@/lib/teamLogos";

interface TeamLogoProps {
  teamName: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** If true, show a circular crop; otherwise square with slight rounding */
  round?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Deterministic color from team name
function teamColor(name: string): string {
  const colors = [
    "oklch(0.38 0.18 260)",
    "oklch(0.38 0.18 140)",
    "oklch(0.38 0.18 30)",
    "oklch(0.38 0.18 320)",
    "oklch(0.38 0.18 200)",
    "oklch(0.38 0.18 60)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

export default function TeamLogo({ teamName, size = 40, className, style, round = false }: TeamLogoProps) {
  const logo = getTeamLogo(teamName);
  const borderRadius = round ? "50%" : size <= 32 ? 4 : 6;

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${teamName} logo`}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius,
          flexShrink: 0,
          display: "block",
          ...style,
        }}
      />
    );
  }

  // Fallback: initials avatar
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        background: teamColor(teamName),
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Barlow Condensed, sans-serif",
        fontWeight: 700,
        fontSize: Math.max(10, size * 0.38),
        letterSpacing: "0.04em",
        flexShrink: 0,
        ...style,
      }}
    >
      {getInitials(teamName)}
    </div>
  );
}
