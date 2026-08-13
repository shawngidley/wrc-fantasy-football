/**
 * PlayerNewsRow — shared component for Injuries and Player News sections.
 * Design: matches the reference screenshot with date column, circular headshot,
 * blue bold player name, pos/team badge, truncated headline with inline expand chevron.
 */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { fetchPlayerByName } from "@/hooks/useTank01Player";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";

export interface PlayerNewsItem {
  playerName: string;
  pos: string;
  nflTeam: string;
  headline: string;
  description?: string;
  published: string;   // ISO date string
  url?: string;
  athleteId?: number;  // ESPN athlete ID for headshot
  isInjury?: boolean;  // red flag icon if true
  source?: "ESPN" | "Tank01" | "FantasyPros";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // If same year, show "Aug 5"; if different year, show "Aug 5 '24"
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${months[d.getMonth()]} ${d.getDate()}${sameYear ? "" : ` '${String(d.getFullYear()).slice(2)}`}`;
}

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length < 2) return fullName;
  // Handle "Jr.", "Sr.", "II", "III" suffixes
  const suffixes = new Set(["jr.", "sr.", "ii", "iii", "iv"]);
  const last = parts[parts.length - 1];
  if (suffixes.has(last.toLowerCase()) && parts.length >= 3) {
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function PlayerNewsRow({
  item,
  isFirst = false,
  showDetails = false,
}: {
  item: PlayerNewsItem;
  isFirst?: boolean;
  showDetails?: boolean;
}) {
  const [expanded, setExpanded] = useState(showDetails);
  const [resolvedHeadshot, setResolvedHeadshot] = useState<string | null>(null);
  const [headshotFailed, setHeadshotFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedHeadshot(null);
    setHeadshotFailed(false);
    if (item.athleteId || item.pos === "DST") return;
    fetchPlayerByName(item.playerName).then(player => {
      if (cancelled) return;
      setResolvedHeadshot(player?.espnHeadshot || getEspnHeadshotUrl(player?.espnID));
    });
    return () => { cancelled = true; };
  }, [item.athleteId, item.playerName, item.pos]);

  const headshotUrl = getEspnHeadshotUrl(item.athleteId) || resolvedHeadshot;

  const playerSlug = encodeURIComponent(item.playerName);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded(v => !v);
  }

  function handleHeadlineClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      setExpanded(v => !v);
    }
  }

  return (
    <div
      style={{
        borderTop: isFirst ? "none" : "1px solid oklch(0.93 0.005 150)",
        padding: "0.55rem 1rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.6rem",
        cursor: "pointer",
        transition: "background 0.12s",
      }}
      className="wrc-row-hover"
      onClick={handleToggle}
    >
      {/* Date column */}
      <div style={{ flexShrink: 0, width: 44, paddingTop: 2 }}>
        <span style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: "0.65rem",
          fontWeight: 600,
          color: "oklch(0.55 0.04 150)",
          whiteSpace: "nowrap" as const,
        }}>
          {formatDate(item.published)}
        </span>
      </div>

      {/* Circular headshot */}
      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "oklch(0.93 0.02 150)", border: "1.5px solid oklch(0.88 0.03 150)" }}>
        {headshotUrl && !headshotFailed ? (
          <img
            src={headshotUrl}
            alt={item.playerName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setHeadshotFailed(true)}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 800, color: "oklch(0.45 0.06 150)" }}>
            {item.playerName.split(" ").map(p => p[0]).slice(0, 2).join("")}
          </div>
        )}
      </div>

      {/* Name + pos/team + headline */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.15rem", flexWrap: "wrap" as const }}>
          <Link
            href={`/player/${playerSlug}`}
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 800, color: "oklch(0.38 0.18 240)", textDecoration: "none", letterSpacing: "0.01em" }}
          >
            {abbreviateName(item.playerName)}
          </Link>
          {item.isInjury && (
            <span style={{ fontSize: "0.7rem" }}>🚩</span>
          )}
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 600, color: "oklch(0.5 0.04 150)" }}>
            {item.pos}· {item.nflTeam}
          </span>
          {item.source && (
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.56rem", fontWeight: 800, color: item.source === "FantasyPros" ? "oklch(0.5 0.16 85)" : "oklch(0.5 0.04 150)", letterSpacing: "0.03em" }}>
              {item.source === "FantasyPros" ? "FP" : item.source}
            </span>
          )}
        </div>
        <div style={{
          fontSize: "0.72rem",
          color: "oklch(0.35 0.04 150)",
          lineHeight: 1.45,
          overflow: expanded ? "visible" : "hidden",
          textOverflow: expanded ? "unset" : "ellipsis",
          whiteSpace: expanded ? "normal" : "nowrap" as const,
          maxWidth: "100%",
        }}>
          <span
            onClick={item.url ? handleHeadlineClick : undefined}
            style={{ cursor: item.url ? "pointer" : "default", textDecoration: item.url ? "underline" : "none", textDecorationColor: "oklch(0.65 0.06 240)" }}
          >
            {item.headline}
          </span>
        </div>
          {expanded && item.description && (
            <div style={{ fontSize: "0.7rem", color: "oklch(0.45 0.04 150)", lineHeight: 1.5, marginTop: "0.3rem" }}>
              {item.description}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ display: "inline-block", marginTop: "0.35rem", fontSize: "0.68rem", color: "oklch(0.42 0.18 240)", fontWeight: 700, textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em" }}
                >
                  Read full article →
                </a>
              )}
            </div>
          )}
          {expanded && !item.description && item.url && (
            <div style={{ marginTop: "0.3rem" }}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: "0.68rem", color: "oklch(0.42 0.18 240)", fontWeight: 700, textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em" }}
              >
                Read full article →
              </a>
            </div>
          )}
      </div>

      {/* Expand chevron */}
      <div style={{ flexShrink: 0, paddingTop: 3, color: "oklch(0.6 0.04 150)" }}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
    </div>
  );
}
