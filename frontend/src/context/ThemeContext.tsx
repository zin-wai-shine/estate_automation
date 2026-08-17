import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  actualTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('estate_theme') as ThemeMode;
    return saved || 'dark';
  });

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let resolved: 'dark' | 'light' = 'dark';
      if (mode === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        resolved = mode;
      }

      root.setAttribute('data-theme', resolved);
      setActualTheme(resolved);
    };

    applyTheme(theme);
    localStorage.setItem('estate_theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
