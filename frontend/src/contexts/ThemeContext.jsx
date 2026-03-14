import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'coreinventory_theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const effective = theme === 'light' || theme === 'dark' ? theme : (systemDark ? 'dark' : 'light');
  const isDark = effective === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effective);
  }, [effective]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemDark(e.matches);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (value) => {
    const next = value === 'light' || value === 'dark' ? value : null;
    setThemeState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  };

  return (
    <ThemeContext.Provider value={{ theme: effective, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
