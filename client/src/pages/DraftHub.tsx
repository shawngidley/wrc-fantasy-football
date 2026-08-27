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
import DraftSubNav from "@/components/DraftSubNav";
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

  const setTab = (tab: DraftTab) => {
    setActiveTab(tab);
    navigate(`/draft?tab=${tab}`);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.14 0.03 150)" }}>
      {/* Sub-tab bar — sits below the main nav */}
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <DraftSubNav active={activeTab} onSelectLocalTab={setTab} />

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
