/**
 * WRC Fantasy Football - Draft Hub
 * Wrapper page with Draft workflow sub-tabs:
 *   - Draft Order  → /draft?tab=board  (DraftBoard)
 *   - Draft Players → /draft?tab=players (DraftPlayers)
 *   - Protections  → /draft?tab=protections  (Protections)
 * Draft Recap lives at /draft-recap as its own page.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import DraftBoard from "./DraftBoard";
import DraftPlayers from "./DraftPlayers";
import Protections from "./Protections";

type DraftTab = "board" | "players" | "protections";

function getTab(search: string): DraftTab {
  const params = new URLSearchParams(search);
  const t = params.get("tab");
  if (t === "players") return "players";
  if (t === "protections") return "protections";
  return "board";
}

export default function DraftHub() {
  const { franchise } = useAuth();
  const [, navigate] = useLocation();

  // Use local state for the active tab — updates instantly on tap
  const [activeTab, setActiveTab] = useState<DraftTab>(() =>
    getTab(typeof window !== "undefined" ? window.location.search : "")
  );

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "recap") {
      navigate("/draft-recap", { replace: true });
    }
  }, [navigate]);

  const tabs: { id: DraftTab; label: string }[] = [
    { id: "board", label: "Draft Order" },
    { id: "players", label: "Draft Players" },
    { id: "protections", label: "Protections" },
  ];

  const setTab = (tab: DraftTab) => {
    setActiveTab(tab);
    navigate(`/draft?tab=${tab}`);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.14 0.03 150)" }}>
      {/* Sub-tab bar — sits below the main nav */}
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{
        background: "oklch(0.18 0.05 150)",
        borderBottom: "2px solid oklch(0.28 0.08 150)",
        position: "sticky",
        top: 56,
        zIndex: 40,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", padding: "0 1rem" }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id
                  ? "3px solid oklch(0.78 0.15 85)"
                  : "3px solid transparent",
                color: activeTab === tab.id
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — render the actual page component */}
      <div style={{ paddingTop: 0 }}>
        {activeTab === "board" && <DraftBoardNoNav />}
        {activeTab === "players" && <DraftPlayersNoNav />}
        {activeTab === "protections" && <ProtectionsNoNav />}
      </div>
    </div>
  );
}

// Wrapper components that suppress the inner Navigation (each page renders its own nav)
// We render the full page components but they include their own Navigation — that's fine,
// the outer Navigation in DraftHub is the canonical one. To avoid double navs, we use
// a simple approach: render the page components directly and let their own nav render
// (they will be hidden by CSS since we already have the hub nav above).
// Actually the cleanest approach: just render the page content directly without wrapping nav.
// Since each page component renders <Navigation> internally, we'll just render them as-is
// and rely on the fact that the sub-tab bar is sticky above the page's own nav.
// Better: render the pages without their nav by passing a prop — but since we can't easily
// do that without modifying each page, we'll use a CSS trick to hide the second nav.

function DraftBoardNoNav() {
  return (
    <div className="draft-hub-child">
      <DraftBoard />
    </div>
  );
}

function DraftPlayersNoNav() {
  return (
    <div className="draft-hub-child">
      <DraftPlayers />
    </div>
  );
}

function ProtectionsNoNav() {
  return (
    <div className="draft-hub-child">
      <Protections />
    </div>
  );
}
