import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth-token";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  permissions: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!token) {
        setLoading(false);
        setUser(null);
        return;
      }
      try {
        const data = await apiRequest<{ user: AuthUser }>("/api/auth/me");
        if (active) setUser(data.user);
      } catch {
        clearAuthToken();
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSession();
    return () => { active = false; };
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    async login(email: string, password: string) {
      const data = await apiRequest<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
    },
    logout() {
      clearAuthToken();
      setToken(null);
      setUser(null);
    },
    can(permission: string) {
      const permissions = user?.permissions ?? [];
      return permissions.includes("*") || permissions.includes(permission);
    },
  }), [loading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
