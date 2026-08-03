/**
 * WRC Fantasy Football - Auth Context
 * Manages franchise login state (team dropdown + PIN)
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getStoredFranchise, storeFranchise, clearFranchise } from "@/lib/supabase";

interface Franchise {
  id: string;
  team_name: string;
  owner_name: string;
  theme_color?: string;
  is_commissioner?: boolean;
}

interface AuthContextType {
  franchise: Franchise | null;
  login: (franchise: Franchise) => void;
  logout: () => void;
  isCommissioner: boolean;
}

const AuthContext = createContext<AuthContextType>({
  franchise: null,
  login: () => {},
  logout: () => {},
  isCommissioner: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [franchise, setFranchise] = useState<Franchise | null>(null);

  useEffect(() => {
    const stored = getStoredFranchise();
    if (stored) setFranchise(stored);
  }, []);

  const login = (f: Franchise) => {
    setFranchise(f);
    storeFranchise(f as unknown as Record<string, unknown>);
  };

  const logout = () => {
    setFranchise(null);
    clearFranchise();
  };

  return (
    <AuthContext.Provider value={{
      franchise,
      login,
      logout,
      isCommissioner: franchise?.is_commissioner === true,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
