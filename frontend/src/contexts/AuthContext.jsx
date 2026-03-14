import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getStoredToken, setStoredToken } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    authApi.status().then((data) => {
      setAuthEnabled(data.data?.authEnabled ?? false);
      if (data.data?.authEnabled) setToken(getStoredToken());
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const handle401 = () => setToken(null);
    window.addEventListener('auth:401', handle401);
    return () => window.removeEventListener('auth:401', handle401);
  }, []);

  const login = (t) => {
    setStoredToken(t);
    setToken(t);
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
  };

  const user = token ? (() => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { sub: payload.sub };
    } catch {
      return null;
    }
  })() : null;

  const value = {
    authEnabled,
    token,
    user,
    authChecked,
    isAuthenticated: !authEnabled || !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
