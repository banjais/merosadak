// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";

type UserRole = "user" | "admin" | "superadmin";

type User = {
  email: string;
  role: UserRole;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, otp: string) => Promise<boolean>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  // Login using OTP
  const login = async (email: string, otp: string): Promise<boolean> => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (data.success) {
        setUser({ email: data.email, role: data.role });
        setToken(data.token);

        localStorage.setItem("user", JSON.stringify({ email: data.email, role: data.role }));
        localStorage.setItem("token", data.token);

        return true;
      }
      return false;
    } catch (err) {
      console.error("[AuthContext] login error:", err);
      return false;
    }
  };

  // Logout user
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // Helper: headers for authorized API requests
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to access auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
