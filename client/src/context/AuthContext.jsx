import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

const normalizeUser = (rawUser) => {
  if (!rawUser) return null;

  return {
    ...rawUser,
    userId: rawUser.userId ?? rawUser.UserID,
    memberId: rawUser.memberId ?? rawUser.MemberID,
    name: rawUser.name ?? rawUser.Name,
    email: rawUser.email ?? rawUser.Email,
    role: rawUser.role ?? rawUser.Role,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Validate stored token on startup ─────────────────────── */
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        const data = res.data?.data ?? res.data;
        const currentUser = normalizeUser(data);

        localStorage.setItem('user', JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /* ── login ─────────────────────────────────────────────────── */
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const payload = res.data?.data ?? res.data;
    const { token, user } = payload;
    const newUser = normalizeUser(user);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);

    return newUser;
  }, []);

  /* ── logout ─────────────────────────────────────────────────── */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};