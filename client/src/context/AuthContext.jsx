import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('dom_token');
    if (!token) { setLoading(false); return; }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      localStorage.removeItem('dom_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!localStorage.getItem('dom_token')) return;
    try {
      const { unreadCount } = await api.getUnreadCount();
      setUnreadCount(unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const interval = setInterval(refreshUnread, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user, refreshUnread]);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('dom_token', token);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    localStorage.removeItem('dom_token');
    setUser(null);
    setUnreadCount(0);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUnread, unreadCount, setUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
