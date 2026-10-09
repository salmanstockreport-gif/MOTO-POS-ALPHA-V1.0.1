import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});

  const loadSettings = () => api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});

  useEffect(() => {
    if (!localStorage.getItem("mp_token")) return setUser(false);
    api.get("/auth/me").then((r) => { setUser(r.data); loadSettings(); }).catch(() => setUser(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("mp_token", data.token);
    setUser(data.user);
    loadSettings();
  };
  const logout = () => { localStorage.removeItem("mp_token"); setUser(false); };

  return (
    <AuthCtx.Provider value={{ user, login, logout, isAdmin: user?.role === "admin", settings, setSettings }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
