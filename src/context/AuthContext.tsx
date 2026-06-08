import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserProfile } from "../types";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginUser: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  googleOAuth: (name: string, email: string, avatar: string, googleId?: string) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read persisted authentication tokens
    const storedToken = localStorage.getItem("vcf_token");
    const storedUser = localStorage.getItem("vcf_user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem("vcf_token");
        localStorage.removeItem("vcf_user");
      }
    }
    setLoading(false);
  }, []);

  const loginUser = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("vcf_token", data.token);
        localStorage.setItem("vcf_user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.message || "Failed to authenticate." };
      }
    } catch (err: any) {
      return { success: false, error: "Network error connecting to platform api." };
    }
  };

  const registerUser = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("vcf_token", data.token);
        localStorage.setItem("vcf_user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.message || "Email registration rejected." };
      }
    } catch (err: any) {
      return { success: false, error: "Server connection failure." };
    }
  };

  const googleOAuth = async (name: string, email: string, avatar: string, googleId?: string) => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, avatar, googleId }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("vcf_token", data.token);
        localStorage.setItem("vcf_user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: "OAuth link rejected." };
      }
    } catch (err) {
      return { success: false, error: "OAuth connection error." };
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("vcf_token");
    localStorage.removeItem("vcf_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, registerUser, googleOAuth, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be executed within an AuthProvider");
  }
  return context;
}
