/**
 * WRC Fantasy Football - Login Page
 * Background: Stadium at night
 * Card: Team dropdown + PIN entry
 * Auth: Supabase teams table PIN verification
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, ChevronDown, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LoggedInTeam } from "@/contexts/AuthContext";
import TeamLogo from "@/components/TeamLogo";

interface TeamRow {
  id: string;
  name: string;
  owner: string;
  division: string;
  faab: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  is_commissioner: boolean;
  pin: string;
}

export default function Login() {
  const [, navigate] = useLocation();
  const { login, franchise, authLoading } = useAuth();

  // Auto-redirect if already logged in — skip login screen entirely
  useEffect(() => {
    if (!authLoading && franchise) {
      navigate("/standings");
    }
  }, [authLoading, franchise, navigate]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Load teams from Supabase on mount
  useEffect(() => {
    supabase
      .from("teams")
      .select("id, name, owner, division, faab, wins, losses, ties, points_for, points_against, is_commissioner, pin")
      .order("name")
      .then(({ data, error: err }) => {
        if (!err && data) setTeams(data as TeamRow[]);
        setLoadingTeams(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedId) { setError("Please select your team."); return; }
    if (!pin) { setError("Please enter your PIN."); return; }
    setLoading(true);

    const team = teams.find(t => t.id === selectedId);
    if (!team || team.pin !== pin) {
      setError("Incorrect PIN. Please try again.");
      setLoading(false);
      return;
    }

    const loggedIn: LoggedInTeam = {
      ...team,
      team_name: team.name,
      owner_name: team.owner,
      auth_pin: team.pin,
    };
    login(loggedIn);
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
          fontFamily: "Barlow Condensed, sans-serif",
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
                fontFamily: "Barlow Condensed, sans-serif",
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
                  disabled={loadingTeams}
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
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  <option value="">{loadingTeams ? "Loading teams…" : "Select Your Team"}</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.owner}</option>
                  ))}
                </select>
                {/* Show selected team logo */}
                {selectedId && (() => {
                  const sel = teams.find(t => t.id === selectedId);
                  return sel ? (
                    <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <TeamLogo teamName={sel.name} size={26} style={{ borderRadius: 4 }} />
                    </div>
                  ) : null;
                })()}
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
                fontFamily: "Barlow Condensed, sans-serif",
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
                    fontFamily: "DM Sans, sans-serif",
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
                fontFamily: "DM Sans, sans-serif",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="wrc-btn-primary"
              disabled={loading || loadingTeams}
              style={{ opacity: (loading || loadingTeams) ? 0.7 : 1 }}
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
        © 2026 Western Reserve Conference Fantasy Football League
      </p>
    </div>
  );
}
