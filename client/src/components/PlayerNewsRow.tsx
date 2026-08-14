/**
 * Shared disclosure row for Injuries and Player News. Native details/summary
 * ensures reliable touch behavior even when parent feeds rerender.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { fetchPlayerByName } from "@/hooks/useTank01Player";
import { getEspnHeadshotUrl } from "@/lib/playerHeadshot";
import { getNewsDisplayName } from "@/lib/newsDisplayName";

export interface PlayerNewsItem {
  playerName: string;
  pos: string;
  nflTeam: string;
  headline: string;
  description?: string;
  published: string;
  url?: string;
  athleteId?: number;
  isInjury?: boolean;
  source?: "ESPN" | "Tank01" | "FantasyPros";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}${d.getFullYear() === now.getFullYear() ? "" : ` '${String(d.getFullYear()).slice(2)}`}`;
}

export function PlayerNewsRow({ item, isFirst = false, showDetails = false }: { item: PlayerNewsItem; isFirst?: boolean; showDetails?: boolean }) {
  const [resolvedHeadshot, setResolvedHeadshot] = useState<string | null>(null);
  const [headshotFailed, setHeadshotFailed] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const displayName = getNewsDisplayName(item.playerName);
  const playerSlug = encodeURIComponent(displayName);
  const detailsId = `news-details-${item.playerName.replace(/[^a-z0-9]/gi, "-")}-${item.published}`;

  useEffect(() => {
    let cancelled = false;
    setResolvedHeadshot(null);
    setHeadshotFailed(false);
    if (item.athleteId || item.pos === "DST") return;
    fetchPlayerByName(item.playerName).then(player => {
      if (!cancelled) setResolvedHeadshot(player?.espnHeadshot || getEspnHeadshotUrl(player?.espnID));
    });
    return () => { cancelled = true; };
  }, [item.athleteId, item.playerName, item.pos]);

  useEffect(() => {
    if (showDetails && detailsRef.current) detailsRef.current.open = true;
  }, [showDetails]);

  const headshotUrl = getEspnHeadshotUrl(item.athleteId) || resolvedHeadshot;
  const initials = item.playerName.split(" ").filter(Boolean).map(part => part[0]).slice(0, 2).join("");

  return (
    <details
      ref={detailsRef}
      className="wrc-row-hover news-disclosure"
      style={{ borderTop: isFirst ? "none" : "1px solid oklch(0.93 0.005 150)", transition: "background 0.12s" }}
    >
      <summary style={{ padding: "0.55rem 1rem", display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", listStyle: "none" }}>
        <div style={{ flexShrink: 0, width: 44, paddingTop: 2 }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 600, color: "oklch(0.55 0.04 150)", whiteSpace: "nowrap" }}>{formatDate(item.published)}</span>
        </div>

        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "oklch(0.93 0.02 150)", border: "1.5px solid oklch(0.88 0.03 150)" }}>
          {headshotUrl && !headshotFailed ? (
            <img src={headshotUrl} alt={item.playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setHeadshotFailed(true)} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.75rem", fontWeight: 800, color: "oklch(0.45 0.06 150)" }}>{initials}</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.15rem", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 800, color: "oklch(0.38 0.18 240)", letterSpacing: "0.01em" }}>{displayName}</span>
            {item.isInjury && <span style={{ fontSize: "0.7rem" }}>🚩</span>}
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.65rem", fontWeight: 600, color: "oklch(0.5 0.04 150)" }}>{item.pos}· {item.nflTeam}</span>
            {item.source && <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.56rem", fontWeight: 800, color: item.source === "FantasyPros" ? "oklch(0.5 0.16 85)" : "oklch(0.5 0.04 150)", letterSpacing: "0.03em" }}>{item.source === "FantasyPros" ? "FP" : item.source}</span>}
          </div>
          <div style={{ fontSize: "0.72rem", color: "oklch(0.35 0.04 150)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", textDecoration: "underline", textDecorationColor: "oklch(0.65 0.06 240)" }}>{item.headline}</div>
        </div>

        <span aria-hidden="true" className="news-disclosure-icon" style={{ flexShrink: 0, marginTop: 1, color: "oklch(0.6 0.04 150)", fontSize: "1rem", lineHeight: 1 }}>⌄</span>
      </summary>

      <div id={detailsId} style={{ margin: "-0.1rem 1rem 0.7rem 6.2rem", fontSize: "0.7rem", color: "oklch(0.45 0.04 150)", lineHeight: 1.5 }}>
        {item.description || "No written summary is available from this news source for this headline."}
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "0.35rem", fontSize: "0.68rem", color: "oklch(0.42 0.18 240)", fontWeight: 700, textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em" }}>Read full article →</a>
        ) : (
          <Link href={`/player/${playerSlug}`} style={{ display: "inline-block", marginTop: "0.35rem", fontSize: "0.68rem", color: "oklch(0.42 0.18 240)", fontWeight: 700, textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.03em" }}>Open player card →</Link>
        )}
      </div>
    </details>
  );
}
