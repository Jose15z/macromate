import { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(api.getToken()));

  useEffect(() => {
    if (!api.getToken()) return;
    api
      .getMe()
      .then((data) => {
        setUser(data.user);
        setProfile(data.profile);
      })
      .catch(() => api.setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    api.setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
  }

  async function register(email, password, displayName) {
    const data = await api.register(email, password, displayName);
    api.setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* token may already be invalid */
    }
    api.setToken(null);
    setUser(null);
    setProfile(null);
  }

  async function saveProfile(fields) {
    const data = await api.updateProfile(fields);
    setProfile(data.profile);
    return data.profile;
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, saveProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
