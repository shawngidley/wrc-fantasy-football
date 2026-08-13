/**
 * WRC Fantasy Football - Auth Context
 * Manages team login state (team dropdown + PIN)
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getStoredTeam, storeTeam, clearTeam, supabase } from "@/lib/supabase";

export interface LoggedInTeam {
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
  // backward-compat aliases used across pages
  team_name: string;
  owner_name: string;
  auth_pin: string;
}

interface AuthContextType {
  team: LoggedInTeam | null;
  /** legacy alias — same object as `team` */
  franchise: LoggedInTeam | null;
  login: (team: LoggedInTeam) => void;
  logout: () => void;
  isCommissioner: boolean;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  team: null,
  franchise: null,
  login: () => {},
  logout: () => {},
  isCommissioner: false,
  authLoading: true,
});

/** Normalise a raw team record so both old and new field names exist */
function normalise(raw: Record<string, unknown>): LoggedInTeam {
  const name = (raw.name ?? raw.team_name ?? "") as string;
  const owner = (raw.owner ?? raw.owner_name ?? "") as string;
  return {
    id: raw.id as string,
    name,
    owner,
    division: (raw.division ?? "") as string,
    faab: (raw.faab ?? 1000) as number,
    wins: (raw.wins ?? 0) as number,
    losses: (raw.losses ?? 0) as number,
    ties: (raw.ties ?? 0) as number,
    points_for: (raw.points_for ?? 0) as number,
    points_against: (raw.points_against ?? 0) as number,
    is_commissioner: (raw.is_commissioner ?? false) as boolean,
    pin: "",
    // aliases
    team_name: name,
    owner_name: owner,
    auth_pin: "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<LoggedInTeam | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredTeam();
    if (stored) {
      // Set from cache immediately so UI is instant
      setTeam(normalise(stored));
      // Silently refresh from Supabase to pick up name/logo/FAAB changes
      const teamId = (stored as Record<string, unknown>).id as string;
      if (teamId) {
        supabase
          .from("teams")
          .select("id, name, owner, division, faab, wins, losses, ties, points_for, points_against, is_commissioner")
          .eq("id", teamId)
          .single()
          .then(({ data }) => {
            if (data) {
              const fresh = normalise(data as unknown as Record<string, unknown>);
              setTeam(fresh);
              storeTeam(fresh as unknown as Record<string, unknown>);
            }
          });
      }
    }
    setAuthLoading(false);
  }, []);

  const login = (t: LoggedInTeam) => {
    const norm = normalise(t as unknown as Record<string, unknown>);
    setTeam(norm);
    storeTeam(norm as unknown as Record<string, unknown>);
  };

  const logout = () => {
    setTeam(null);
    clearTeam();
  };

  return (
    <AuthContext.Provider value={{
      team,
      franchise: team,
      login,
      logout,
      isCommissioner: team?.is_commissioner === true,
      authLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
