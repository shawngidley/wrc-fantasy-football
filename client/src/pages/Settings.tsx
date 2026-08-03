/**
 * WRC Fantasy Football - Settings Page
 * Team settings: view team info, change PIN, logout
 * PINs are stored in localStorage per team (overrides wrcData default)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, LogOut, User, Shield, CheckCircle2, Eye, EyeOff, RefreshCw, ClipboardList, AlertTriangle } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

const PROTECTIONS_STORAGE_KEY = "wrc_protections_v3";

function loadAllProtections(): Record<string, Array<{ playerId: string; assignedRound: number | null }>> {
  try { return JSON.parse(localStorage.getItem(PROTECTIONS_STORAGE_KEY) ?? "{}"); } catch { return {}; }
}

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

// ── Commissioner PIN Reset Panel ──────────────────────────────────────────
function CommissionerPinPanel({ labelStyle }: { labelStyle: React.CSSProperties }) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    if (!selectedTeamId) { setResetError("Select a team first."); return; }
    if (newPin.length < 4) { setResetError("New PIN must be at least 4 characters."); return; }
    savePin(selectedTeamId, newPin);
    const team = TEAMS.find(t => t.id === selectedTeamId);
    setResetSuccess(`PIN reset for ${team?.teamName ?? selectedTeamId} to "${newPin}".`);
    setNewPin("");
    setSelectedTeamId("");
  };

  const handleResetToDefault = (teamId: string) => {
    const pins = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) ?? "{}");
    delete pins[teamId];
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins));
    const team = TEAMS.find(t => t.id === teamId);
    setResetSuccess(`PIN for ${team?.teamName ?? teamId} reset to default (1234).`);
  };

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem", border: "2px solid oklch(0.78 0.15 85)" }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "oklch(0.95 0.06 85)" }}>
        <Shield size={14} color="oklch(0.45 0.14 85)" />
        <span style={{ color: "oklch(0.35 0.14 85)" }}>Commissioner: Reset Team PINs</span>
      </div>
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1.25rem" }}>
          Use this panel to reset any team's PIN if they are locked out. Only visible to the commissioner.
        </p>

        {/* All teams quick-reset table */}
        <div style={{ marginBottom: "1.25rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                {["Team","Owner","Current PIN","Reset to Default"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEAMS.map((t, i) => {
                const effectivePin = getEffectivePin(t.id);
                const isOverridden = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) ?? "{}")[t.id];
                return (
                  <tr key={t.id} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                    <td style={{ padding: "0.45rem 0.75rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem" }}>{t.teamName}</td>
                    <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>{t.owner}</td>
                    <td style={{ padding: "0.45rem 0.75rem" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: isOverridden ? "oklch(0.35 0.15 150)" : "oklch(0.55 0.04 150)", fontSize: "0.9rem" }}>{effectivePin}</span>
                      {isOverridden && <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "oklch(0.45 0.14 85)", fontWeight: 600 }}>custom</span>}
                    </td>
                    <td style={{ padding: "0.45rem 0.75rem" }}>
                      {isOverridden && (
                        <button
                          onClick={() => handleResetToDefault(t.id)}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "oklch(0.95 0.03 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 5, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", cursor: "pointer" }}
                        >
                          <RefreshCw size={11} /> Reset to 1234
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Set specific PIN form */}
        <form onSubmit={handleReset} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={labelStyle}>Team</label>
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1.5px solid oklch(0.85 0.01 150)", borderRadius: 8, fontSize: "0.88rem", color: "oklch(0.2 0.03 150)", background: "white", outline: "none" }}
            >
              <option value="">Select team...</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.teamName} ({t.owner})</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={labelStyle}>New PIN</label>
            <input
              type="text"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="Min 4 chars"
              maxLength={12}
              style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1.5px solid oklch(0.85 0.01 150)", borderRadius: 8, fontSize: "0.88rem", color: "oklch(0.2 0.03 150)", background: "white", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            style={{ background: "oklch(0.45 0.14 85)", color: "white", border: "none", borderRadius: 8, padding: "0.6rem 1.25rem", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Set PIN
          </button>
        </form>

        {resetError && <div style={{ marginTop: "0.75rem", color: "oklch(0.45 0.18 25)", fontSize: "0.82rem", fontWeight: 600 }}>{resetError}</div>}
        {resetSuccess && <div style={{ marginTop: "0.75rem", color: "oklch(0.35 0.15 150)", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> {resetSuccess}</div>}
      </div>
    </div>
  );
}

// ── Commissioner Protections Overview Panel ──────────────────────────────────
function CommissionerProtectionsPanel() {
  const allProtections = loadAllProtections();
  const DEADLINE = new Date("2026-08-24T20:00:00-04:00");
  const isPastDeadline = Date.now() > DEADLINE.getTime();

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem", border: "2px solid oklch(0.78 0.15 85)" }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "oklch(0.95 0.06 85)" }}>
        <ClipboardList size={14} color="oklch(0.45 0.14 85)" />
        <span style={{ color: "oklch(0.35 0.14 85)" }}>Commissioner: All Team Protections</span>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: isPastDeadline ? "oklch(0.45 0.18 25)" : "oklch(0.42 0.15 150)" }}>
          {isPastDeadline ? "DEADLINE PASSED" : "DEADLINE: AUG 24 8PM ET"}
        </span>
      </div>
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1.25rem" }}>
          Shows each team's submitted keeper selections. Teams that haven't submitted yet are flagged.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                {["Team", "Owner", "Status", "Protected Players", "Picks Forfeited"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEAMS.map((team, i) => {
                const teamSlots = allProtections[team.id] ?? [];
                const hasSubmitted = teamSlots.length > 0;
                const hasUnassigned = teamSlots.some(s => s.assignedRound === null);

                // Resolve player names
                const playerDetails = teamSlots.map(slot => {
                  const player = team.players?.find((p: { id: string; name: string }) => p.id === slot.playerId);
                  return {
                    name: player?.name ?? slot.playerId,
                    round: slot.assignedRound,
                  };
                });

                return (
                  <tr key={team.id} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", whiteSpace: "nowrap" }}>{team.teamName}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "oklch(0.45 0.04 150)", whiteSpace: "nowrap" }}>{team.owner}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {!hasSubmitted ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "oklch(0.45 0.18 25)", background: "oklch(0.97 0.02 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 4, padding: "2px 7px" }}>
                          <AlertTriangle size={11} /> Not Submitted
                        </span>
                      ) : hasUnassigned ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "oklch(0.45 0.14 85)", background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.85 0.12 85)", borderRadius: 4, padding: "2px 7px" }}>
                          <AlertTriangle size={11} /> Incomplete
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "oklch(0.35 0.15 150)", background: "oklch(0.94 0.05 150)", border: "1px solid oklch(0.82 0.1 150)", borderRadius: 4, padding: "2px 7px" }}>
                          <CheckCircle2 size={11} /> Submitted
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {playerDetails.length === 0 ? (
                        <span style={{ color: "oklch(0.7 0.02 150)", fontSize: "0.78rem" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {playerDetails.map((p, j) => (
                            <span key={j} style={{ fontSize: "0.8rem", fontWeight: 600, color: "oklch(0.25 0.06 150)" }}>{p.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {playerDetails.length === 0 ? (
                        <span style={{ color: "oklch(0.7 0.02 150)", fontSize: "0.78rem" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {playerDetails.map((p, j) => (
                            <span key={j} style={{ fontSize: "0.78rem", fontWeight: 700, color: p.round ? "oklch(0.35 0.12 150)" : "oklch(0.55 0.18 25)" }}>
                              {p.round ? `Round ${p.round}` : "⚠ Unassigned"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "1rem 0 0", fontSize: "0.75rem", color: "oklch(0.6 0.04 150)" }}>
          Note: Protections are stored locally in each owner's browser. This view only shows submissions made on this device.
        </p>
      </div>
    </div>
  );
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

        {/* Commissioner PIN Reset Panel — only visible to commissioner */}
        {franchise?.is_commissioner && (
          <CommissionerPinPanel labelStyle={labelStyle} />
        )}

        {/* Commissioner Protections Overview — only visible to commissioner */}
        {franchise?.is_commissioner && (
          <CommissionerProtectionsPanel />
        )}

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
