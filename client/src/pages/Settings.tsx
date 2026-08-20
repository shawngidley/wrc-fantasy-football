/**
 * WRC Fantasy Football - Settings Page
 * PIN management now persisted in Supabase teams table.
 * Commissioner panel reads all team protections from Supabase.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Lock, LogOut, User, Shield, CheckCircle2, Eye, EyeOff,
  RefreshCw, ClipboardList, AlertTriangle, Music, Upload, Trash2, Play, Square,
  Fingerprint,
} from "lucide-react";
import { Image } from "lucide-react";
import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { WRC_PROTECTION_DEADLINE, WRC_PROTECTION_DEADLINE_DISPLAY } from "@shared/protectionSchedule";
import { startRegistration } from "@simplewebauthn/browser";
import { canUseWrcPasskeys } from "@/lib/wrcPasskey";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function mediaContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/m4a", aac: "audio/aac" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

// ── Commissioner PIN Reset Panel ──────────────────────────────────────────────
function CommissionerPinPanel({ labelStyle }: { labelStyle: React.CSSProperties }) {
  const [teams, setTeams] = useState<Array<{ id: string; name: string; owner: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const directoryQuery = trpc.league.commissionerTeamDirectory.useQuery();
  const setTeamPinMutation = trpc.league.commissionerSetTeamPin.useMutation();

  useEffect(() => {
    if (directoryQuery.data) setTeams(directoryQuery.data);
  }, [directoryQuery.data]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(""); setResetSuccess("");
    if (!selectedTeamId) { setResetError("Select a team first."); return; }
    if (newPin.length < 4) { setResetError("New PIN must be at least 4 characters."); return; }
    setLoading(true);
    try {
      const result = await setTeamPinMutation.mutateAsync({ teamId: selectedTeamId, newPin });
      setResetSuccess(`PIN for ${result.teamName} was updated.`);
      setNewPin(""); setSelectedTeamId("");
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Failed to update PIN.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async (teamId: string) => {
    try {
      const result = await setTeamPinMutation.mutateAsync({ teamId, newPin: "1234" });
      setResetSuccess(`PIN for ${result.teamName} was reset to the default.`);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Failed to reset PIN.");
    }
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
          Reset any team's PIN if they are locked out. Changes are saved to the database immediately.
        </p>

        {/* All teams table */}
        <div style={{ marginBottom: "1.25rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                {["Team","Owner","Reset"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.id} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                  <td style={{ padding: "0.45rem 0.75rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem" }}>{t.name}</td>
                  <td style={{ padding: "0.45rem 0.75rem", color: "oklch(0.45 0.04 150)" }}>{t.owner}</td>
                  <td style={{ padding: "0.45rem 0.75rem" }}>
                    <button
                      onClick={() => handleResetToDefault(t.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "oklch(0.95 0.03 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 5, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", cursor: "pointer" }}
                    >
                      <RefreshCw size={11} /> Reset to 1234
                    </button>
                  </td>
                </tr>
              ))}
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
              {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>)}
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
            disabled={loading}
            style={{ background: "oklch(0.45 0.14 85)", color: "white", border: "none", borderRadius: 8, padding: "0.6rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Saving..." : "Set PIN"}
          </button>
        </form>

        {resetError && <div style={{ marginTop: "0.75rem", color: "oklch(0.45 0.18 25)", fontSize: "0.82rem", fontWeight: 600 }}>{resetError}</div>}
        {resetSuccess && <div style={{ marginTop: "0.75rem", color: "oklch(0.35 0.15 150)", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> {resetSuccess}</div>}
      </div>
    </div>
  );
}

// ── Commissioner Protections Overview Panel ───────────────────────────────────
function CommissionerProtectionsPanel() {
  const DEADLINE = WRC_PROTECTION_DEADLINE;
  const isPastDeadline = Date.now() > DEADLINE.getTime();

  interface ProtRow {
    team_id: string;
    player_id: string;
    tier: string;
    forfeited_round: number | null;
    submitted: boolean;
    players: { name: string } | null;
  }
  interface TeamRow { id: string; name: string; owner: string; }

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [protections, setProtections] = useState<ProtRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const protectionOverviewQuery = trpc.league.commissionerProtectionsOverview.useQuery();

  useEffect(() => {
    setLoadingData(protectionOverviewQuery.isLoading || protectionOverviewQuery.isFetching);
    if (protectionOverviewQuery.data) {
      setTeams(protectionOverviewQuery.data.teams as TeamRow[]);
      setProtections(protectionOverviewQuery.data.protections as unknown as ProtRow[]);
    }
  }, [protectionOverviewQuery.data, protectionOverviewQuery.isFetching, protectionOverviewQuery.isLoading]);

  return (
    <div className="wrc-card" style={{ marginBottom: "1.25rem", border: "2px solid oklch(0.78 0.15 85)" }}>
      <div className="wrc-card-gold-stripe" />
      <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "oklch(0.95 0.06 85)" }}>
        <ClipboardList size={14} color="oklch(0.45 0.14 85)" />
        <span style={{ color: "oklch(0.35 0.14 85)" }}>Commissioner: All Team Protections</span>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: isPastDeadline ? "oklch(0.45 0.18 25)" : "oklch(0.42 0.15 150)" }}>
          {isPastDeadline ? "DEADLINE PASSED" : `DEADLINE: ${WRC_PROTECTION_DEADLINE_DISPLAY.toUpperCase()}`}
        </span>
      </div>
      <div style={{ padding: "1.25rem" }}>
        {loadingData ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "oklch(0.55 0.04 150)", fontSize: "0.88rem" }}>Loading protections…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid oklch(0.88 0.02 150)" }}>
                  {["Team", "Owner", "Status", "Protected Players", "Picks Forfeited"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.75rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.45 0.06 150)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => {
                  const teamProts = protections.filter(p => p.team_id === team.id);
                  const hasSubmitted = teamProts.length > 0 && teamProts.some(p => p.submitted);
                  const hasUnassigned = teamProts.some(p => p.forfeited_round === null);

                  return (
                    <tr key={team.id} style={{ background: i%2===0?"white":"oklch(0.97 0.005 150)", borderBottom: "1px solid oklch(0.93 0.01 150)" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "oklch(0.22 0.08 150)", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.82rem", whiteSpace: "nowrap" }}>{team.name}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "oklch(0.45 0.04 150)", whiteSpace: "nowrap" }}>{team.owner}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {!hasSubmitted ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.45 0.18 25)", background: "oklch(0.97 0.02 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 4, padding: "2px 7px" }}>
                            <AlertTriangle size={11} /> Not Submitted
                          </span>
                        ) : hasUnassigned ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.45 0.14 85)", background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.85 0.12 85)", borderRadius: 4, padding: "2px 7px" }}>
                            <AlertTriangle size={11} /> Incomplete
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, color: "oklch(0.35 0.15 150)", background: "oklch(0.94 0.05 150)", border: "1px solid oklch(0.82 0.1 150)", borderRadius: 4, padding: "2px 7px" }}>
                            <CheckCircle2 size={11} /> Submitted
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {teamProts.length === 0 ? (
                          <span style={{ color: "oklch(0.7 0.02 150)", fontSize: "0.78rem" }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {teamProts.map((p, j) => (
                              <span key={j} style={{ fontSize: "0.8rem", fontWeight: 600, color: "oklch(0.25 0.06 150)" }}>{p.players?.name ?? p.player_id}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {teamProts.length === 0 ? (
                          <span style={{ color: "oklch(0.7 0.02 150)", fontSize: "0.78rem" }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {teamProts.map((p, j) => (
                              <span key={j} style={{ fontSize: "0.78rem", fontWeight: 700, color: p.forfeited_round ? "oklch(0.35 0.12 150)" : "oklch(0.55 0.18 25)" }}>
                                {p.forfeited_round ? `Round ${p.forfeited_round}` : "⚠ Unassigned"}
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
        )}
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const { franchise, logout } = useAuth();
  const [, navigate] = useLocation();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  // ── Theme Song state ──
  const [themeSongUrl, setThemeSongUrl] = useState<string | null>(null);
  const [themeSongName, setThemeSongName] = useState<string | null>(null);
  const [uploadingTheme, setUploadingTheme] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [themeSuccess, setThemeSuccess] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Team Logo state ──
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoSuccess, setLogoSuccess] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeySuccess, setPasskeySuccess] = useState("");
  const settingsQuery = trpc.league.teamSettings.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const changePinMutation = trpc.league.changeTeamPin.useMutation();
  const uploadMediaMutation = trpc.league.uploadTeamMedia.useMutation();
  const removeMediaMutation = trpc.league.removeTeamMedia.useMutation();
  const passkeysQuery = trpc.league.passkeys.useQuery(undefined, { enabled: Boolean(franchise?.id), retry: false });
  const startPasskeyRegistrationMutation = trpc.league.startPasskeyRegistration.useMutation();
  const finishPasskeyRegistrationMutation = trpc.league.finishPasskeyRegistration.useMutation();
  const removePasskeyMutation = trpc.league.removePasskey.useMutation();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setLogoUrl(settingsQuery.data.logoUrl);
    setThemeSongUrl(settingsQuery.data.themeSongUrl);
    if (settingsQuery.data.themeSongUrl) {
      const parts = settingsQuery.data.themeSongUrl.split("/");
      setThemeSongName(decodeURIComponent(parts[parts.length - 1]));
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    let cancelled = false;
    canUseWrcPasskeys().then(available => {
      if (!cancelled) setPasskeyAvailable(available);
    }).catch(() => {
      if (!cancelled) setPasskeyAvailable(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !franchise) return;
    setLogoError(""); setLogoSuccess("");
    if (file.size > 5 * 1024 * 1024) { setLogoError("File must be under 5MB."); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { setLogoError("Only JPG, PNG, WEBP, or GIF files are supported."); return; }
    setUploadingLogo(true);
    try {
      const result = await uploadMediaMutation.mutateAsync({ kind: "logo", fileName: file.name, contentType: mediaContentType(file), base64Data: await fileToBase64(file) });
      setLogoUrl(result.url);
      setLogoSuccess("Team logo uploaded!");
      if (logoInputRef.current) logoInputRef.current.value = "";
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!franchise) return;
    setLogoError(""); setLogoSuccess("");
    try {
      await removeMediaMutation.mutateAsync({ kind: "logo" });
      setLogoUrl(null);
      setLogoSuccess("Team logo removed. Default logo restored.");
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "Unable to remove team logo.");
    }
  };

  const handleThemeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !franchise) return;
    setThemeError(""); setThemeSuccess("");
    if (file.size > 10 * 1024 * 1024) { setThemeError("File must be under 10MB."); return; }
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/aac", "audio/x-m4a"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      setThemeError("Only MP3, WAV, OGG, M4A, or AAC files are supported."); return;
    }
    setUploadingTheme(true);
    try {
      const result = await uploadMediaMutation.mutateAsync({ kind: "theme", fileName: file.name, contentType: mediaContentType(file), base64Data: await fileToBase64(file) });
      setThemeSongUrl(result.url);
      setThemeSongName(file.name);
      setThemeSuccess("Theme song uploaded!");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setThemeError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingTheme(false);
    }
  };

  const handleRemoveTheme = async () => {
    if (!franchise || !themeSongUrl) return;
    setThemeError(""); setThemeSuccess("");
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }
    try {
      await removeMediaMutation.mutateAsync({ kind: "theme" });
      setThemeSongUrl(null); setThemeSongName(null);
      setThemeSuccess("Theme song removed.");
    } catch (error) {
      setThemeError(error instanceof Error ? error.message : "Unable to remove theme song.");
    }
  };

  const handlePlayPause = () => {
    if (!themeSongUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(themeSongUrl);
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(""); setPinSuccess(false);
    if (!franchise) return;

    if (newPin.length < 4) { setPinError("New PIN must be at least 4 digits."); return; }
    if (newPin !== confirmPin) { setPinError("New PINs do not match."); return; }

    setSavingPin(true);
    try {
      await changePinMutation.mutateAsync({ currentPin, newPin });
      setPinSuccess(true);
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    } catch (error) {
      setPinError(error instanceof Error ? error.message : "Failed to save PIN.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handlePasskeyEnrollment = async () => {
    setPasskeyError(""); setPasskeySuccess("");
    setPasskeyBusy(true);
    try {
      const start = await startPasskeyRegistrationMutation.mutateAsync();
      const response = await startRegistration({ optionsJSON: start.options });
      await finishPasskeyRegistrationMutation.mutateAsync({ challengeId: start.challengeId, response });
      await passkeysQuery.refetch();
      setPasskeySuccess("Face ID sign-in is ready on this device.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Face ID setup was not completed.";
      setPasskeyError(message.includes("canceled") || message.includes("not allowed") ? "Face ID setup was canceled." : message);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRemovePasskey = async (credentialId: string) => {
    if (!window.confirm("Remove this Face ID sign-in method? You can add it again later with your PIN.")) return;
    setPasskeyError(""); setPasskeySuccess("");
    try {
      await removePasskeyMutation.mutateAsync({ credentialId });
      await passkeysQuery.refetch();
      setPasskeySuccess("Face ID sign-in method removed.");
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : "Unable to remove this Face ID sign-in method.");
    }
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
    fontFamily: "DM Sans, sans-serif",
    letterSpacing: "0.15em",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "Barlow Condensed, sans-serif",
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
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "oklch(0.22 0.08 150)" }}>
                  {franchise?.name ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Owner</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "oklch(0.22 0.08 150)" }}>
                  {franchise?.owner ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Division</div>
                <div style={{ fontSize: "0.9rem", color: "oklch(0.4 0.04 150)", fontWeight: 600 }}>
                  {franchise?.division ?? "—"} Division
                </div>
              </div>
              <div>
                <div style={labelStyle}>FAAB Budget</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "oklch(0.35 0.13 150)" }}>
                  ${franchise?.faab ?? 1000}
                </div>
              </div>
              {franchise?.is_commissioner && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    background: "oklch(0.93 0.06 85)", color: "oklch(0.35 0.14 85)",
                    borderRadius: 6, padding: "3px 10px",
                    fontSize: "0.75rem", fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em",
                  }}>
                    <Shield size={12} /> Commissioner
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Face ID / Passkey Card */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Fingerprint size={15} /> Face ID Sign-In
          </div>
          <div style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1rem", lineHeight: 1.5 }}>
              Use Face ID, Touch ID, or your device screen lock to sign in without entering your PIN. Your biometric information stays on your device.
            </p>
            {!passkeyAvailable ? (
              <div style={{ borderRadius: 8, padding: "0.75rem 0.9rem", background: "oklch(0.96 0.02 85)", border: "1px solid oklch(0.86 0.06 85)", color: "oklch(0.42 0.1 85)", fontSize: "0.82rem", lineHeight: 1.45 }}>
                Face ID setup is available from the public WRC site on a device with Face ID, Touch ID, Windows Hello, or another supported device lock.
              </div>
            ) : (
              <>
                {(passkeysQuery.data ?? []).length > 0 && (
                  <div style={{ display: "grid", gap: "0.55rem", marginBottom: "1rem" }}>
                    {(passkeysQuery.data ?? []).map(passkey => (
                      <div key={passkey.credentialId} style={{ display: "flex", alignItems: "center", gap: "0.7rem", borderRadius: 8, border: "1px solid oklch(0.86 0.02 150)", padding: "0.65rem 0.75rem", background: "oklch(0.985 0.004 150)" }}>
                        <Fingerprint size={17} color="oklch(0.35 0.12 150)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "oklch(0.25 0.07 150)" }}>Face ID sign-in ready</div>
                          <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>{passkey.lastUsedAt ? `Last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}` : `Added ${new Date(passkey.createdAt).toLocaleDateString()}`}</div>
                        </div>
                        <button type="button" onClick={() => void handleRemovePasskey(passkey.credentialId)} disabled={removePasskeyMutation.isPending} style={{ border: "1px solid oklch(0.85 0.08 25)", background: "oklch(0.97 0.02 25)", color: "oklch(0.45 0.18 25)", borderRadius: 6, padding: "0.35rem 0.5rem", cursor: removePasskeyMutation.isPending ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.72rem" }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => void handlePasskeyEnrollment()} disabled={passkeyBusy} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", border: "none", borderRadius: 8, padding: "0.6rem 1rem", background: "oklch(0.28 0.09 150)", color: "white", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: passkeyBusy ? "not-allowed" : "pointer", opacity: passkeyBusy ? 0.65 : 1 }}>
                  <Fingerprint size={16} /> {passkeyBusy ? "Setting Up…" : (passkeysQuery.data ?? []).length ? "Add Another Device" : "Set Up Face ID"}
                </button>
              </>
            )}
            {passkeyError && <div style={{ marginTop: "0.8rem", color: "oklch(0.45 0.18 25)", fontSize: "0.82rem", fontWeight: 600 }}>{passkeyError}</div>}
            {passkeySuccess && <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: "0.8rem", color: "oklch(0.35 0.15 150)", fontSize: "0.82rem", fontWeight: 600 }}><CheckCircle2 size={15} /> {passkeySuccess}</div>}
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
                disabled={savingPin}
                style={{
                  background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 8,
                  padding: "0.6rem 1.5rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem",
                  fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                  opacity: savingPin ? 0.7 : 1,
                }}
              >
                {savingPin ? "Saving…" : "Update PIN"}
              </button>
            </form>
          </div>
        </div>

        {/* Theme Song Card */}
        {/* Team Logo Card */}
        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Image size={14} /> Team Logo
          </div>
          <div style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1.25rem" }}>
              Upload a custom team logo — it replaces your logo everywhere on the site (nav, standings, matchup panel, lineup, etc.). JPG, PNG, or WEBP · Max 5MB · Square images work best.
            </p>

            {/* Current logo preview */}
            {logoUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "oklch(0.94 0.05 150)", border: "1.5px solid oklch(0.82 0.1 150)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1rem" }}>
                <img src={logoUrl} alt="Team logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "2px solid oklch(0.78 0.15 85)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "oklch(0.22 0.08 150)" }}>Custom Logo Active</div>
                  <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>Showing on all pages</div>
                </div>
                <button onClick={handleRemoveLogo} title="Remove" style={{ background: "oklch(0.97 0.02 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 6, padding: "0.35rem 0.5rem", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {/* Upload button */}
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" onChange={handleLogoUpload} style={{ display: "none" }} id="team-logo-input" />
            <label htmlFor="team-logo-input" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: uploadingLogo ? "oklch(0.88 0.01 150)" : "oklch(0.28 0.09 150)", color: "white", borderRadius: 8, padding: "0.6rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: uploadingLogo ? "not-allowed" : "pointer", pointerEvents: uploadingLogo ? "none" : "auto" }}>
              <Upload size={14} /> {uploadingLogo ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
            </label>

            {logoError && <div style={{ marginTop: "0.75rem", color: "oklch(0.45 0.18 25)", fontSize: "0.82rem", fontWeight: 600 }}>{logoError}</div>}
            {logoSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", color: "oklch(0.35 0.15 150)", fontSize: "0.82rem", fontWeight: 600 }}>
                <CheckCircle2 size={15} /> {logoSuccess}
              </div>
            )}
          </div>
        </div>

        <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
          <div className="wrc-card-gold-stripe" />
          <div className="wrc-card-header" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Music size={14} /> Draft Theme Song
          </div>
          <div style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "oklch(0.5 0.04 150)", margin: "0 0 1.25rem" }}>
              Upload your theme song — it plays automatically on the Draft Board when you go on the clock. MP3, WAV, OGG, M4A, or AAC · Max 10MB.
            </p>

            {/* Current song */}
            {themeSongUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "oklch(0.94 0.05 150)", border: "1.5px solid oklch(0.82 0.1 150)", borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1rem" }}>
                <Music size={16} color="oklch(0.35 0.15 150)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "oklch(0.22 0.08 150)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{themeSongName ?? "Theme Song"}</div>
                  <div style={{ fontSize: "0.72rem", color: "oklch(0.5 0.04 150)" }}>Uploaded · plays on draft clock</div>
                </div>
                <button onClick={handlePlayPause} title={isPlaying ? "Stop" : "Preview"} style={{ background: "oklch(0.28 0.09 150)", color: "white", border: "none", borderRadius: 6, padding: "0.35rem 0.6rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.72rem", fontWeight: 700 }}>
                  {isPlaying ? <><Square size={11} /> Stop</> : <><Play size={11} /> Preview</>}
                </button>
                <button onClick={handleRemoveTheme} title="Remove" style={{ background: "oklch(0.97 0.02 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 6, padding: "0.35rem 0.5rem", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {/* Upload button */}
            <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/aac,.mp3,.wav,.ogg,.m4a,.aac" onChange={handleThemeUpload} style={{ display: "none" }} id="theme-song-input" />
            <label htmlFor="theme-song-input" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: uploadingTheme ? "oklch(0.88 0.01 150)" : "oklch(0.28 0.09 150)", color: "white", borderRadius: 8, padding: "0.6rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: uploadingTheme ? "not-allowed" : "pointer", pointerEvents: uploadingTheme ? "none" : "auto" }}>
              <Upload size={14} /> {uploadingTheme ? "Uploading…" : themeSongUrl ? "Replace Song" : "Upload Song"}
            </label>

            {themeError && <div style={{ marginTop: "0.75rem", color: "oklch(0.45 0.18 25)", fontSize: "0.82rem", fontWeight: 600 }}>{themeError}</div>}
            {themeSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", color: "oklch(0.35 0.15 150)", fontSize: "0.82rem", fontWeight: 600 }}>
                <CheckCircle2 size={15} /> {themeSuccess}
              </div>
            )}
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
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "oklch(0.22 0.08 150)", marginBottom: "0.2rem" }}>
                Sign Out
              </div>
              <div style={{ fontSize: "0.82rem", color: "oklch(0.5 0.04 150)" }}>
                You will be returned to the login screen.
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "oklch(0.97 0.02 25)", color: "oklch(0.45 0.18 25)",
                border: "1.5px solid oklch(0.85 0.08 25)", borderRadius: 8,
                padding: "0.6rem 1.25rem", fontFamily: "Barlow Condensed, sans-serif", fontSize: "0.85rem",
                fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
