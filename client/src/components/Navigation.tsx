/**
 * WRC Fantasy Football - Shared Navigation Component
 * Dark green sticky nav with hamburger menu for mobile
 * Gold ticker bar below nav for live alerts
 */
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, Menu, Settings, ChevronDown } from "lucide-react";

type NavLink = { label: string; path: string; live?: boolean };

// Primary links — always visible in desktop nav bar
const primaryLinks: NavLink[] = [
  { label: "Standings", path: "/standings" },
  { label: "Playoffs", path: "/playoffs" },
  { label: "Live", path: "/live", live: true },
  { label: "Lineup", path: "/lineup" },
  { label: "Rosters", path: "/rosters" },
  { label: "Rundown", path: "/rundown" },
  { label: "News", path: "/news" },
  { label: "Free Agents", path: "/free-agents" },
  { label: "Transactions", path: "/transactions" },
  { label: "Results", path: "/results" },
  { label: "Trades", path: "/trades" },
];

// Secondary links — shown in "More ▾" dropdown on desktop, and inline on mobile
const secondaryLinks: NavLink[] = [
  { label: "Money", path: "/money" },
  { label: "History", path: "/history" },
  { label: "Schedule", path: "/schedule" },
  { label: "Protections", path: "/protections" },
  { label: "Draft", path: "/draft" },
  { label: "Draft Recap", path: "/draft-recap" },
  { label: "Rules", path: "/rules" },
  { label: "NFL Sites", path: "/nfl-sites" },
];

const navLinks: NavLink[] = [...primaryLinks, ...secondaryLinks];

// ── More ▾ Dropdown ───────────────────────────────────────────────────────────
function MoreDropdown({ location }: { location: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = secondaryLinks.some(l => l.path === location);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`wrc-nav-link ${isActive ? "active" : ""}`}
        style={{
          display: "flex", alignItems: "center", gap: "3px",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: "inherit",
        }}
      >
        More <ChevronDown size={12} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          background: "oklch(0.18 0.06 150)",
          border: "1px solid oklch(0.32 0.08 150)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          minWidth: 160,
          zIndex: 200,
          overflow: "hidden",
        }}>
          {secondaryLinks.map(link => (
            <button
              key={link.path}
              onClick={() => { navigate(link.path); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "0.55rem 1rem",
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.04em",
                background: location === link.path ? "oklch(0.28 0.09 150)" : "none",
                color: location === link.path ? "oklch(0.78 0.15 85)" : "rgba(255,255,255,0.85)",
                border: "none", cursor: "pointer",
                borderBottom: "1px solid oklch(0.25 0.06 150)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (location !== link.path) (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.24 0.07 150)"; }}
              onMouseLeave={e => { if (location !== link.path) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
              <div style={{
                background: "oklch(0.28 0.09 150)",
                border: "2px solid oklch(0.78 0.15 85)",
                borderRadius: 6,
                padding: "2px 10px",
                fontFamily: "Barlow Condensed, sans-serif",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "white",
                letterSpacing: "0.06em",
              }}>
                WRC
              </div>
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
            <div className="wrc-desktop-nav" style={{ display: "flex", alignItems: "center", gap: "0.1rem", flex: 1, flexWrap: "nowrap", overflow: "hidden" }}>
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
              {/* More ▾ dropdown for secondary links */}
              <MoreDropdown location={location} />
            </div>

            {/* Right side: team name + hamburger */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto", flexShrink: 0 }}>
              {teamName && (
                <span style={{
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: "0.8rem",
                  color: "oklch(0.78 0.15 85)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                  {teamName}
                </span>
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
        {navLinks.map((link) => (
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
        ))}
      </div>

      {/* Overlay */}
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
