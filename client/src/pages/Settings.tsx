/**
 * WRC Fantasy Football - Settings Page
 * Team settings: view team info, change PIN, logout
 * PINs are stored in localStorage per team (overrides wrcData default)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, LogOut, User, Shield, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

// PIN storage helpers — per-team override stored in localStorage
const PIN_STORAGE_KEY = "wrc_team_pins";

function getStoredPins(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePin(teamId: string, pin: string) {
  const pins = getStoredPins();
  pins[teamId] = pin;
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins));
}

export function getEffectivePin(teamId: string): string {
  const stored = getStoredPins()[teamId];
  if (stored) return stored;
  const team = TEAMS.find(t => t.id === teamId);
  return team?.pin ?? "1234";
}

export default function Settings() {
  const { franchise, logout } = useAuth();
  const [, navigate] = useLocation();

  const team = TEAMS.find(t => t.teamName === franchise?.team_name);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  const handlePinChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    setPinSuccess(false);

    if (!team) return;

    // Verify current PIN
    const effective = getEffectivePin(team.id);
    if (currentPin !== effective) {
      setPinError("Current PIN is incorrect.");
      return;
    }
    if (newPin.length < 4) {
      setPinError("New PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PINs do not match.");
      return;
    }

    savePin(team.id, newPin);
    setPinSuccess(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 2.5rem 0.7rem 0.875rem",
    border: "1.5px solid oklch(0.85 0.01 150)",
    borderRadius: 8,
    fontSize: "0.95rem",
    color: "oklch(0.2 0.03 150)",
    background: "white",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    letterSpacing: "0.15em",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "Oswald, sans-serif",
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "oklch(0.35 0.06 150)",
    marginBottom: "0.45rem",
  };

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Page title */}
        <div className="wrc-page-title" style={{ padding: "0 0 1.25rem" }}>
          <h1>Settings</h1>
          <p>Manage your team PIN and account preferences</p>
        </div>

        {/* Team Info Card */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <User size={14} /> Team Information
          </div>
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <div style={labelStyle}>Team Name</div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "oklch(0.22 0.08 150)" }}>
                  {franchise?.team_name ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Owner</div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "oklch(0.22 0.08 150)" }}>
                  {franchise?.owner_name ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Division</div>
                <div style={{ fontSize: "0.9rem", color: "oklch(0.4 0.04 150)", fontWeight: 600 }}>
                  {team?.division ?? "—"} Division
                </div>
              </div>
              <div>
                <div style={labelStyle}>FAAB Budget</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "oklch(0.35 0.13 150)" }}>
                  ${team?.faabRemaining ?? 1000}
                </div>
              </div>
              {franchise?.is_commissioner && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    background: "oklch(0.93 0.06 85)", color: "oklch(0.35 0.14 85)",
                    borderRadius: 6, padding: "3px 10px",
                    fontSize: "0.75rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em",
                  }}>
                    <Shield size={12} /> Commissioner
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Change PIN Card */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={14} /> Change PIN
          </div>
          <div style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1.25rem" }}>
              Your PIN is used to log in. Choose something memorable but not obvious. Minimum 4 characters.
            </p>

            <form onSubmit={handlePinChange}>
              {/* Current PIN */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Current PIN</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    placeholder="Enter current PIN"
                    maxLength={12}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.04 150)", padding: 0 }}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New PIN */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>New PIN</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    placeholder="Enter new PIN (min 4 chars)"
                    maxLength={12}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "oklch(0.55 0.04 150)", padding: 0 }}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm PIN */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Confirm New PIN</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    placeholder="Re-enter new PIN"
                    maxLength={12}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Error / Success */}
              {pinError && (
                <div style={{ background: "oklch(0.97 0.02 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 6, padding: "0.6rem 0.875rem", color: "oklch(0.45 0.18 25)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  {pinError}
                </div>
              )}
              {pinSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "oklch(0.94 0.05 150)", border: "1px solid oklch(0.82 0.1 150)", borderRadius: 6, padding: "0.6rem 0.875rem", color: "oklch(0.35 0.15 150)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem" }}>
                  <CheckCircle2 size={16} /> PIN updated successfully!
                </div>
              )}

              <button
                type="submit"
                style={{
                  background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 8,
                  padding: "0.6rem 1.5rem", fontFamily: "Oswald, sans-serif", fontSize: "0.85rem",
                  fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Update PIN
              </button>
            </form>
          </div>
        </div>

        {/* Logout Card */}
        <div className="wrc-card">
          <div className="wrc-card-gold-stripe" />
          <div style={{ padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "oklch(0.22 0.08 150)", marginBottom: "0.2rem" }}>
                Sign Out
              </div>
              <div style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)" }}>
                You'll need your PIN to sign back in as {franchise?.team_name ?? "your team"}.
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                background: "oklch(0.95 0.03 25)", color: "oklch(0.45 0.18 25)",
                border: "1.5px solid oklch(0.85 0.08 25)", borderRadius: 8,
                padding: "0.55rem 1.25rem", fontFamily: "Oswald, sans-serif",
                fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", cursor: "pointer",
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
