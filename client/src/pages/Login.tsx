/**
 * WRC Fantasy Football - Login Page
 * Background: Stadium at night
 * Card: Team dropdown + PIN entry
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, ChevronDown, Trophy } from "lucide-react";
import { TEAMS } from "@/lib/wrcData";

// Real franchises — PINs stored in wrcData.ts
const FRANCHISES = [
  ...TEAMS.map(t => ({ id: t.id, team_name: t.teamName, owner_name: t.owner, auth_pin: t.pin, is_commissioner: t.id === "dan" })),
  { id: "guest", team_name: "Guest", owner_name: "Guest", auth_pin: "0000", is_commissioner: false },
];

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedId) { setError("Please select your team."); return; }
    if (!pin) { setError("Please enter your PIN."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const franchise = FRANCHISES.find(f => f.id === selectedId);
    if (!franchise || franchise.auth_pin !== pin) {
      setError("Incorrect PIN. Please try again.");
      setLoading(false);
      return;
    }
    login({ id: franchise.id, team_name: franchise.team_name, owner_name: franchise.owner_name, is_commissioner: franchise.is_commissioner });
    navigate("/standings");
  };

  return (
    <div
      className="bg-stadium-night bg-overlay"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "1rem" }}
    >
      {/* Logo + Title above card */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 72,
          height: 72,
          background: "oklch(0.22 0.08 150)",
          border: "3px solid oklch(0.78 0.15 85)",
          borderRadius: 12,
          marginBottom: "1rem",
        }}>
          <Trophy size={36} color="oklch(0.78 0.15 85)" />
        </div>
        <h1 style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
          color: "white",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          margin: 0,
        }}>
          WRC Fantasy Football
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem", margin: "0.4rem 0 0", letterSpacing: "0.04em" }}>
          2026 Season
        </p>
      </div>

      {/* Login Card */}
      <div className="wrc-card" style={{ width: "100%", maxWidth: 440 }}>
        <div className="wrc-card-gold-stripe" />
        <div className="wrc-card-body" style={{ padding: "2rem" }}>
          <form onSubmit={handleLogin}>
            {/* Team Select */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{
                display: "block",
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "oklch(0.35 0.06 150)",
                marginBottom: "0.5rem",
              }}>
                Select Your Team
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 0.875rem",
                    border: "1.5px solid oklch(0.85 0.01 150)",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    color: selectedId ? "oklch(0.2 0.03 150)" : "oklch(0.55 0.03 150)",
                    background: "white",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <option value="">Select Your Team</option>
                  {FRANCHISES.map(f => (
                    <option key={f.id} value={f.id}>{f.team_name} — {f.owner_name}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "oklch(0.5 0.04 150)", pointerEvents: "none" }}
                />
              </div>
            </div>

            {/* PIN Entry */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "oklch(0.35 0.06 150)",
                marginBottom: "0.5rem",
              }}>
                Enter Your PIN
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  maxLength={8}
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 0.875rem",
                    border: "1.5px solid oklch(0.85 0.01 150)",
                    borderRadius: 8,
                    fontSize: "1rem",
                    color: "oklch(0.2 0.03 150)",
                    background: "white",
                    outline: "none",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.2em",
                    boxSizing: "border-box",
                  }}
                />
                <Lock
                  size={16}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "oklch(0.6 0.04 150)" }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "oklch(0.97 0.02 25)",
                border: "1px solid oklch(0.85 0.08 25)",
                borderRadius: 6,
                padding: "0.6rem 0.875rem",
                color: "oklch(0.45 0.18 25)",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                fontFamily: "Inter, sans-serif",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="wrc-btn-primary"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p style={{
        color: "rgba(255,255,255,0.35)",
        fontSize: "0.75rem",
        marginTop: "2rem",
        textAlign: "center",
        letterSpacing: "0.02em",
      }}>
        © 2025 Western Reserve Conference Fantasy Football League
      </p>
    </div>
  );
}
