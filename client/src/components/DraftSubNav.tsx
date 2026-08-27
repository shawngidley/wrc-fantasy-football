/**
 * WRC Fantasy Football - Draft Sub-Nav
 * Shared tab bar for the four Draft-related pages (Draft Order, Draft Players,
 * Protections, Draft Lottery). Previously only rendered inside DraftHub.tsx,
 * so navigating to Draft Lottery (a separate route/page) lost the tab bar
 * entirely with no easy way back. Both pages now render this same component.
 */
import { useLocation } from "wouter";

export type DraftSubNavTab = "board" | "players" | "protections" | "lottery";

const TABS: { id: DraftSubNavTab; label: string; path: string }[] = [
  { id: "board", label: "Draft Order", path: "/draft?tab=board" },
  { id: "players", label: "Draft Players", path: "/draft?tab=players" },
  { id: "protections", label: "Protections", path: "/draft?tab=protections" },
  { id: "lottery", label: "Draft Lottery", path: "/draft-lottery" },
];

interface DraftSubNavProps {
  active: DraftSubNavTab;
  /** If provided, selecting a board/players/protections tab updates local
   * state instantly instead of a full navigation (used by DraftHub, which
   * hosts those three as in-place tab switches). Selecting Draft Lottery
   * always does a full navigation regardless, since it's a separate route. */
  onSelectLocalTab?: (tab: "board" | "players" | "protections") => void;
}

export default function DraftSubNav({ active, onSelectLocalTab }: DraftSubNavProps) {
  const [, navigate] = useLocation();

  return (
    <div style={{
      background: "oklch(0.18 0.05 150)",
      borderBottom: "2px solid oklch(0.28 0.08 150)",
      position: "sticky",
      top: 56,
      zIndex: 40,
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", padding: "0 1rem", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id !== "lottery" && onSelectLocalTab) {
                onSelectLocalTab(tab.id);
              } else {
                navigate(tab.path);
              }
              window.scrollTo(0, 0);
            }}
            style={{
              padding: "0.75rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: active === tab.id
                ? "3px solid oklch(0.78 0.15 85)"
                : "3px solid transparent",
              color: active === tab.id
                ? "oklch(0.78 0.15 85)"
                : "rgba(255,255,255,0.55)",
              fontFamily: "Barlow Condensed, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
