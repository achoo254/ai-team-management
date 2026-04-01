import { createContext, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  team: "dev" | "mkt";
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user ?? null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCurrentUser();
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Proceed with local logout even if request fails
    } finally {
      setUser(null);
      navigate("/login");
    }
  }

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
