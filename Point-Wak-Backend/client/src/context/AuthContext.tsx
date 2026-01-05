import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, UserRole } from "@shared/schema";
import { UserRoles } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface SessionUser {
  id: string;
  accountId: string;
  username: string;
  name: string;
  fullName?: string | null;
  email?: string | null;
  role: string;
  availability: string;
  phoneNumber?: string | null;
  locationId?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAvailability: (status: "available" | "busy" | "offline") => void;
  isSuperAdmin: boolean;
  isAccountAdmin: boolean;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("[Auth] Session check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const setAvailability = async (status: "available" | "busy" | "offline") => {
    if (!user) return;
    try {
      const response = await fetch(`/api/users/${user.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: status }),
        credentials: "include",
      });
      if (response.ok) {
        setUser({ ...user, availability: status });
      }
    } catch (error) {
      console.error("[Auth] Failed to update availability:", error);
    }
  };

  const isSuperAdmin = user?.role === UserRoles.SUPER_ADMIN;
  const isAccountAdmin = user?.role === UserRoles.SUPER_ADMIN || user?.role === UserRoles.ACCOUNT_ADMIN;
  
  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      logout, 
      setAvailability,
      isSuperAdmin,
      isAccountAdmin,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
