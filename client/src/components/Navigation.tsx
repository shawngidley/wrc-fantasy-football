/**
 * WRC Fantasy Football - Shared Navigation Component
 * Dark green sticky nav with hamburger menu for mobile
 * Gold ticker bar below nav for live alerts
 */
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, Menu, Settings, ChevronDown, ChevronRight } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";

type NavLink = { label: string; path: string; live?: boolean };

// All desktop nav links — shown directly in the nav bar (no More dropdown)
const primaryLinks: NavLink[] = [
  { label: "Standings", path: "/standings" },
  { label: "Live", path: "/live", live: true },
  { label: "Lineup", path: "/lineup" },
  { label: "Rosters", path: "/rosters" },
  { label: "Free Agents", path: "/free-agents" },
  { label: "Transactions", path: "/transactions" },
  { label: "Schedule", path: "/schedule" },
  { label: "News", path: "/news" },
  { label: "Trades", path: "/trades" },
  { label: "Draft", path: "/draft" },
  { label: "Draft Recap", path: "/draft-recap" },
  { label: "NFL Sites", path: "/nfl-sites" },
];

// Full ordered list for mobile hamburger menu (user-specified order)
// Draft is a group — its sub-items are rendered inline when expanded
const navLinks: NavLink[] = [
  { label: "Standings", path: "/standings" },
  { label: "Live", path: "/live", live: true },
  { label: "Draft", path: "/draft" }, // expandable group
  { label: "Draft Recap", path: "/draft-recap" },
  { label: "Lineup", path: "/lineup" },
  { label: "Rosters", path: "/rosters" },
  { label: "Free Agents", path: "/free-agents" },
  { label: "Transactions", path: "/transactions" },
  { label: "Schedule & Results", path: "/schedule" },
  { label: "News", path: "/news" },
  { label: "Trades", path: "/trades" },
  { label: "League", path: "/league" }, // expandable group
  { label: "NFL Sites", path: "/nfl-sites" },
];

// ── Mobile Nav List with expandable Draft group ───────────────────────────────
const DRAFT_SUB_ITEMS = [
  { label: "Draft Order", path: "/draft" },
  { label: "Draft Players", path: "/draft?tab=players" },
  { label: "Protections", path: "/draft?tab=protections" },
];

const LEAGUE_SUB_ITEMS = [
  { label: "Rules", path: "/rules" },
  { label: "Money", path: "/money" },
  { label: "History", path: "/history" },
];

function MobileNavList({ location, setMobileOpen }: { location: string; setMobileOpen: (v: boolean) => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);

  const isDraftActive = location === "/draft" || location.startsWith("/draft?");
  const isLeagueActive = LEAGUE_SUB_ITEMS.some((item) => location === item.path);

  return (
    <>
      {navLinks.map((link) => {
        if (link.label === "Draft") {
          return (
            <div key="draft-group">
              {/* Draft header — tapping toggles sub-menu */}
              <button
                onClick={() => setDraftOpen(o => !o)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: isDraftActive ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.85)",
                }}
              >
                DRAFT
                <ChevronDown
                  size={16}
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    transform: draftOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </button>
              {/* Sub-items */}
              {draftOpen && (
                <div style={{ paddingLeft: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {DRAFT_SUB_ITEMS.map(sub => (
                    <button
                      key={sub.path}
                      onClick={() => {
                        window.location.href = sub.path;
                        setMobileOpen(false);
                        setDraftOpen(false);
                      }}
                      style={{
                        width: "100%", background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.6rem 0",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.65)",
                        textAlign: "left",
                      }}
                    >
                      <ChevronRight size={12} style={{ color: "oklch(0.78 0.15 85)", flexShrink: 0 }} />
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (link.label === "League") {
          return (
            <div key="league-group">
              <button
                onClick={() => setLeagueOpen(o => !o)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.05rem",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: isLeagueActive ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.85)",
                }}
              >
                LEAGUE
                <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.5)", transform: leagueOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>
              {leagueOpen && (
                <div style={{ paddingLeft: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {LEAGUE_SUB_ITEMS.map(sub => (
                    <button
                      key={sub.path}
                      onClick={() => { window.location.href = sub.path; setMobileOpen(false); setLeagueOpen(false); }}
                      style={{
                        width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "Barlow Condensed, sans-serif",
                        fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", textAlign: "left",
                      }}
                    >
                      <ChevronRight size={12} style={{ color: "oklch(0.78 0.15 85)", flexShrink: 0 }} />
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <Link
            key={link.path}
            href={link.path}
            className={`wrc-mobile-nav-link ${location === link.path ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {link.live && (
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#ef4444", display: "inline-block",
                animation: "pulse 1.5s infinite",
              }} />
            )}
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

interface NavigationProps {
  tickerMessages?: string[];
  showTicker?: boolean;
  teamName?: string;
}

export default function Navigation({
  tickerMessages = [],
  showTicker = false,
  teamName,
}: NavigationProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const isLeagueActive = LEAGUE_SUB_ITEMS.some((item) => location === item.path);

  const defaultTicker = [
    "⚔️ CHALLENGE GAME IN PROGRESS: Vipers vs. Legends",
    "📅 LINEUP LOCK: Sunday 1:00pm ET",
    "🏈 WRC FANTASY FOOTBALL 2026",
  ];
  const messages = tickerMessages.length > 0 ? tickerMessages : defaultTicker;
  const tickerText = messages.join("   •   ");

  return (
    <>
      {/* Main Nav */}
      <nav className="wrc-nav">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", height: 52, gap: "1rem" }}>
            {/* Logo */}
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none", flexShrink: 0 }}>
              <img
                src="/manus-storage/wrc-griffin-192_225a52c5.png"
                alt="WRC"
                style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }}
              />
              <span style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 500,
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                Fantasy Football
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="wrc-desktop-nav" style={{ display: "flex", alignItems: "center", gap: "0", flex: 1, flexWrap: "nowrap", overflow: "visible", minWidth: 0 }}>
              {primaryLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`wrc-nav-link ${location === link.path ? "active" : ""}`}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  {link.live && (
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: location === "/live" ? "#ef4444" : "rgba(239,68,68,0.5)",
                      display: "inline-block",
                      animation: location === "/live" ? "pulse 1.5s infinite" : "none",
                    }} />
                  )}
                  {link.label}
                </Link>
              ))}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  className={`wrc-nav-link ${isLeagueActive ? "active" : ""}`}
                  onClick={() => setLeagueOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={leagueOpen}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}
                >
                  League <ChevronDown size={12} style={{ transform: leagueOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                </button>
                {leagueOpen && (
                  <div role="menu" aria-label="League" style={{ position: "absolute", zIndex: 50, top: "calc(100% + 0.3rem)", right: 0, minWidth: 108, overflow: "hidden", borderRadius: 8, border: "1px solid rgba(218,176,74,0.45)", background: "oklch(0.19 0.06 150)", boxShadow: "0 10px 24px rgb(0 0 0 / 0.28)" }}>
                    {LEAGUE_SUB_ITEMS.map((item) => (
                      <Link key={item.path} href={item.path} role="menuitem" onClick={() => setLeagueOpen(false)} style={{ display: "block", padding: "0.5rem 0.75rem", color: location === item.path ? "oklch(0.8 0.15 85)" : "rgba(255,255,255,0.82)", textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.76rem", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: team name + hamburger */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto", flexShrink: 0 }}>
              {teamName && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <TeamLogo teamName={teamName} size={28} round style={{ border: "1.5px solid oklch(0.78 0.15 85)", flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "0.8rem",
                    color: "oklch(0.78 0.15 85)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {teamName}
                  </span>
                </div>
              )}
              {teamName && (
                <Link
                  href="/settings"
                  style={{ display: "flex", alignItems: "center", color: location === "/settings" ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.6)", transition: "color 0.15s" }}
                  title="Settings"
                >
                  <Settings size={18} />
                </Link>
              )}
              <button
                className="wrc-hamburger"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                style={{ background: "none", border: "none", padding: 4 }}
              >
                <Menu color="white" size={24} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Ticker */}
      {showTicker && (
        <div className="wrc-ticker">
          <span className="wrc-ticker-inner">
            {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
          </span>
        </div>
      )}

      {/* Mobile Nav Drawer */}
      <div className={`wrc-mobile-nav ${mobileOpen ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif",
            fontWeight: 700,
            fontSize: "1.2rem",
            color: "oklch(0.78 0.15 85)",
            letterSpacing: "0.08em",
          }}>
            WRC MENU
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
          >
            <X size={28} />
          </button>
        </div>
        <MobileNavList location={location} setMobileOpen={setMobileOpen} />
      </div>

      {/* Overlay — z-index must be BELOW the mobile nav (999) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 998,
          }}
        />
      )}
    </>
  );
}
